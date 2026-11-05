"""add_user_permissions

Revision ID: b5d9e2f3c4a6
Revises: a4c8e1f2b3d5
Create Date: 2026-11-05 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5d9e2f3c4a6'
down_revision: Union[str, None] = 'a4c8e1f2b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('permissions', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'permissions')
