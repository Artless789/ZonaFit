"""add is_popular and features to plans

Revision ID: e1f2a3b4c5d6
Revises: d1e2f3a4b5c6
Create Date: 2026-09-06 21:15:00.000000

"""
from typing import Sequence, Union
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if context.is_offline_mode():
        op.add_column(
            'plans',
            sa.Column('is_popular', sa.Boolean(), nullable=True, server_default=sa.text('false'))
        )
        op.add_column(
            'plans',
            sa.Column('features', sa.JSON(), nullable=True, server_default=sa.text("'[]'"))
        )
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('plans')]

    if 'is_popular' not in columns:
        op.add_column(
            'plans',
            sa.Column('is_popular', sa.Boolean(), nullable=True, server_default=sa.text('false'))
        )

    if 'features' not in columns:
        op.add_column(
            'plans',
            sa.Column('features', sa.JSON(), nullable=True, server_default=sa.text("'[]'"))
        )


def downgrade() -> None:
    if context.is_offline_mode():
        op.drop_column('plans', 'features')
        op.drop_column('plans', 'is_popular')
        return

    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('plans')]

    if 'features' in columns:
        op.drop_column('plans', 'features')

    if 'is_popular' in columns:
        op.drop_column('plans', 'is_popular')
