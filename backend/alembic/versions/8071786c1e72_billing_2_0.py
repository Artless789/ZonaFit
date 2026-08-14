"""Billing 2.0

Revision ID: 8071786c1e72
Revises: 749df0509657
Create Date: 2026-08-09 20:24:25.439083

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8071786c1e72'
down_revision: Union[str, Sequence[str], None] = '749df0509657'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('subscriptions', sa.Column('payment_source_id', sa.String(255), nullable=True))
    op.add_column('subscriptions', sa.Column('payment_method_type', sa.String(50), nullable=True))
    op.add_column('subscriptions', sa.Column('payment_method_last4', sa.String(4), nullable=True))
    op.add_column('subscriptions', sa.Column('cancellation_requested_at', sa.DateTime(), nullable=True))

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subscriptions', 'cancellation_requested_at')
    op.drop_column('subscriptions', 'payment_method_last4')
    op.drop_column('subscriptions', 'payment_method_type')
    op.drop_column('subscriptions', 'payment_source_id')
