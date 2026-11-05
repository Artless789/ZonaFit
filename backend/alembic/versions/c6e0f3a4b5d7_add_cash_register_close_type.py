"""add cash register close_type

Revision ID: c6e0f3a4b5d7
Revises: b5d9e2f3c4a6
Create Date: 2026-11-05 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6e0f3a4b5d7'
down_revision: Union[str, None] = 'b5d9e2f3c4a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'cash_registers',
        sa.Column('close_type', sa.String(length=20), nullable=False, server_default='MANUAL')
    )


def downgrade() -> None:
    op.drop_column('cash_registers', 'close_type')
