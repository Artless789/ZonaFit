"""add_audit_log_fields

Revision ID: a4c8e1f2b3d5
Revises: f3b4c5d6e7f8
Create Date: 2026-11-05 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4c8e1f2b3d5'
down_revision: Union[str, None] = 'f3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add descriptive and contextual columns to audit_logs
    op.add_column('audit_logs', sa.Column('user_name', sa.String(length=150), nullable=True))
    op.add_column('audit_logs', sa.Column('module', sa.String(length=50), nullable=True))
    op.add_column('audit_logs', sa.Column('entity_name', sa.String(length=200), nullable=True))
    op.add_column('audit_logs', sa.Column('description', sa.String(length=500), nullable=True))
    op.add_column('audit_logs', sa.Column('status', sa.String(length=20), nullable=True, server_default='SUCCESS'))

    # 2. Widen action column from 30 to 60 to accommodate descriptive action tags
    op.alter_column('audit_logs', 'action',
                    type_=sa.String(length=60),
                    existing_type=sa.String(length=30),
                    nullable=False)

    # 3. Create index on module
    op.create_index(op.f('ix_audit_logs_module'), 'audit_logs', ['module'], unique=False)

    # 4. Create composite index on (gym_id, created_at) for fast chronological auditing per tenant
    op.create_index('ix_audit_logs_gym_created', 'audit_logs', ['gym_id', 'created_at'], unique=False)


def downgrade() -> None:
    # 1. Drop composite index
    op.drop_index('ix_audit_logs_gym_created', table_name='audit_logs')

    # 2. Drop module index
    op.drop_index(op.f('ix_audit_logs_module'), table_name='audit_logs')

    # 3. Restore action column length to 30
    op.alter_column('audit_logs', 'action',
                    type_=sa.String(length=30),
                    existing_type=sa.String(length=60),
                    nullable=False)

    # 4. Drop added columns
    op.drop_column('audit_logs', 'status')
    op.drop_column('audit_logs', 'description')
    op.drop_column('audit_logs', 'entity_name')
    op.drop_column('audit_logs', 'module')
    op.drop_column('audit_logs', 'user_name')
