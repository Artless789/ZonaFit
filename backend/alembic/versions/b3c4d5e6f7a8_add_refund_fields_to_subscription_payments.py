"""add refund fields to subscription_payments

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f1
Create Date: 2026-09-06 23:04:00.000000

"""
from typing import Sequence, Union
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'a2b3c4d5e6f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.add_column(
            'subscription_payments',
            sa.Column('refund_reason', sa.String(length=255), nullable=True)
        )
        op.add_column(
            'subscription_payments',
            sa.Column('refunded_at', sa.DateTime(), nullable=True)
        )
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('subscription_payments')]

    if 'refund_reason' not in columns:
        op.add_column(
            'subscription_payments',
            sa.Column('refund_reason', sa.String(length=255), nullable=True)
        )
    if 'refunded_at' not in columns:
        op.add_column(
            'subscription_payments',
            sa.Column('refunded_at', sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    if context.is_offline_mode():
        op.drop_column('subscription_payments', 'refunded_at')
        op.drop_column('subscription_payments', 'refund_reason')
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('subscription_payments')]

    if 'refunded_at' in columns:
        op.drop_column('subscription_payments', 'refunded_at')
    if 'refund_reason' in columns:
        op.drop_column('subscription_payments', 'refund_reason')
