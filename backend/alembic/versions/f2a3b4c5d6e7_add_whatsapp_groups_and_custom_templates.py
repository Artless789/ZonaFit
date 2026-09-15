"""add_whatsapp_groups_and_custom_templates

Revision ID: f2a3b4c5d6e7
Revises: e6f7a8b9c0d1
Create Date: 2026-09-14 23:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e6f7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create whatsapp_groups table
    op.create_table(
        'whatsapp_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gym_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('invite_url', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['gym_id'], ['gyms.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_whatsapp_groups_id'), 'whatsapp_groups', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_groups_gym_id'), 'whatsapp_groups', ['gym_id'], unique=False)

    # Enable RLS on whatsapp_groups if PostgreSQL
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;")
        op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON whatsapp_groups;")
        op.execute("""
        CREATE POLICY tenant_isolation_policy ON whatsapp_groups
        FOR ALL
        USING (
            gym_id = current_setting('app.current_gym_id', true)::integer 
            OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
            gym_id = current_setting('app.current_gym_id', true)::integer 
            OR current_setting('app.bypass_rls', true) = 'on'
        );
        """)

    # 2. Add whatsapp_opt_in and whatsapp_group_id to clients
    op.add_column('clients', sa.Column('whatsapp_opt_in', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('clients', sa.Column('whatsapp_group_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_clients_whatsapp_group_id',
        'clients',
        'whatsapp_groups',
        ['whatsapp_group_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index(op.f('ix_clients_whatsapp_group_id'), 'clients', ['whatsapp_group_id'], unique=False)

    # 3. Add custom_event_name and description to notification_templates
    op.add_column('notification_templates', sa.Column('custom_event_name', sa.String(length=100), nullable=True))
    op.add_column('notification_templates', sa.Column('description', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('notification_templates', 'description')
    op.drop_column('notification_templates', 'custom_event_name')

    op.drop_index(op.f('ix_clients_whatsapp_group_id'), table_name='clients')
    op.drop_constraint('fk_clients_whatsapp_group_id', 'clients', type_='foreignkey')
    op.drop_column('clients', 'whatsapp_group_id')
    op.drop_column('clients', 'whatsapp_opt_in')

    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON whatsapp_groups;")
        op.execute("ALTER TABLE whatsapp_groups DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_whatsapp_groups_gym_id'), table_name='whatsapp_groups')
    op.drop_index(op.f('ix_whatsapp_groups_id'), table_name='whatsapp_groups')
    op.drop_table('whatsapp_groups')
