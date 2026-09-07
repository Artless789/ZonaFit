"""add last_emergency_extension_at to subscriptions

Revision ID: f1e2a3b4c5d6
Revises: e1f2a3b4c5d6
Create Date: 2026-09-06 22:18:00.000000

"""
from typing import Sequence, Union
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'f1e2a3b4c5d6'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.add_column(
            'subscriptions',
            sa.Column('last_emergency_extension_at', sa.DateTime(), nullable=True)
        )
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('subscriptions')]

    if 'last_emergency_extension_at' not in columns:
        op.add_column(
            'subscriptions',
            sa.Column('last_emergency_extension_at', sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    if context.is_offline_mode():
        op.drop_column('subscriptions', 'last_emergency_extension_at')
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('subscriptions')]

    if 'last_emergency_extension_at' in columns:
        op.drop_column('subscriptions', 'last_emergency_extension_at')
