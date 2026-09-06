"""Add reconciliation_data to cash_registers

Revision ID: a1b2c3d4e5f6
Revises: 2512b531b806
Create Date: 2026-08-20 16:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e8d2c41f90ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cash_registers', sa.Column('reconciliation_data', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('cash_registers', 'reconciliation_data')
