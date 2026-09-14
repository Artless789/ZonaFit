"""add_base_price_and_discount_to_memberships

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-09-14 09:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6f7a8b9c0d1'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('memberships', sa.Column('base_price', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('memberships', sa.Column('discount', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'))
    
    # Backfill base_price with current price for existing rows
    op.execute("UPDATE memberships SET base_price = price WHERE base_price IS NULL")


def downgrade() -> None:
    op.drop_column('memberships', 'discount')
    op.drop_column('memberships', 'base_price')
