"""alter plan and membership_plan description to text

Revision ID: e8d2c41f90ab
Revises: 2512b531b806
Create Date: 2026-08-19 10:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e8d2c41f90ab'
down_revision: Union[str, Sequence[str], None] = '2512b531b806'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter membership_plans.description from VARCHAR(255) to TEXT
    op.alter_column(
        'membership_plans',
        'description',
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True
    )
    # Alter plans.description from VARCHAR(255) to TEXT
    op.alter_column(
        'plans',
        'description',
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True
    )


def downgrade() -> None:
    op.alter_column(
        'plans',
        'description',
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True
    )
    op.alter_column(
        'membership_plans',
        'description',
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True
    )
