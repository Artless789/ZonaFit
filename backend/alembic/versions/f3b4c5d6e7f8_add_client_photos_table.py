"""add_client_photos_table

Revision ID: f3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-09-28 23:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create client_photos table
    op.create_table(
        'client_photos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gym_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=64), nullable=False),
        sa.Column('content_type', sa.String(length=64), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['gym_id'], ['gyms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('client_id', name='uq_client_photos_client_id'),
        sa.UniqueConstraint('filename', name='uq_client_photos_filename')
    )
    op.create_index(op.f('ix_client_photos_id'), 'client_photos', ['id'], unique=False)
    op.create_index(op.f('ix_client_photos_gym_id'), 'client_photos', ['gym_id'], unique=False)
    op.create_index(op.f('ix_client_photos_client_id'), 'client_photos', ['client_id'], unique=True)
    op.create_index(op.f('ix_client_photos_filename'), 'client_photos', ['filename'], unique=True)

    # Enable RLS on client_photos if PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE client_photos ENABLE ROW LEVEL SECURITY;")
        op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON client_photos;")
        op.execute("""
        CREATE POLICY tenant_isolation_policy ON client_photos
        FOR ALL
        USING (
            gym_id = nullif(current_setting('app.current_gym_id', true), '')::integer
            OR nullif(current_setting('app.bypass_rls', true), '') = 'on'
        )
        WITH CHECK (
            gym_id = nullif(current_setting('app.current_gym_id', true), '')::integer
            OR nullif(current_setting('app.bypass_rls', true), '') = 'on'
        );
        """)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON client_photos;")
        op.execute("ALTER TABLE client_photos DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_client_photos_filename'), table_name='client_photos')
    op.drop_index(op.f('ix_client_photos_client_id'), table_name='client_photos')
    op.drop_index(op.f('ix_client_photos_gym_id'), table_name='client_photos')
    op.drop_index(op.f('ix_client_photos_id'), table_name='client_photos')
    op.drop_table('client_photos')
