"""create gym settings table

Revision ID: a3f2c8d91e47
Revises: 1a0e78bac423
Create Date: 2026-08-06 13:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f2c8d91e47'
down_revision: Union[str, Sequence[str], None] = '1a0e78bac423'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'gym_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gym_id', sa.Integer(), nullable=False),
        sa.Column('legal_name', sa.String(length=150), nullable=False),
        sa.Column('trade_name', sa.String(length=100), nullable=False),
        sa.Column('tax_id', sa.String(length=30), nullable=False),
        sa.Column('tax_regime', sa.String(length=50), nullable=True),
        sa.Column('official_phone', sa.String(length=20), nullable=False),
        sa.Column('official_email', sa.String(length=150), nullable=False),
        sa.Column('physical_address', sa.String(length=200), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=50), nullable=False, server_default='Colombia'),
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='COP'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='America/Bogota'),
        sa.Column('default_tax_percentage', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('receipt_footer_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['gym_id'], ['gyms.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gym_id', name='uq_gym_settings_gym_id'),
    )
    op.create_index(op.f('ix_gym_settings_id'), 'gym_settings', ['id'], unique=False)
    op.create_index(op.f('ix_gym_settings_gym_id'), 'gym_settings', ['gym_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_gym_settings_gym_id'), table_name='gym_settings')
    op.drop_index(op.f('ix_gym_settings_id'), table_name='gym_settings')
    op.drop_table('gym_settings')
