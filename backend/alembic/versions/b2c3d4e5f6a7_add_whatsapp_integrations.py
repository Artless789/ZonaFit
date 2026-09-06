"""add_whatsapp_integrations_and_notification_fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-05 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create whatsapp_integrations table
    op.create_table(
        'whatsapp_integrations',
        sa.Column('id', sa.Integer(), nullable=False, primary_key=True),
        sa.Column('gym_id', sa.Integer(), sa.ForeignKey('gyms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('waba_id', sa.String(length=100), nullable=True),
        sa.Column('phone_number_id', sa.String(length=100), nullable=False),
        sa.Column('business_id', sa.String(length=100), nullable=True),
        sa.Column('display_phone_number', sa.String(length=50), nullable=True),
        sa.Column('verified_name', sa.String(length=150), nullable=True),
        sa.Column('access_token_encrypted', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='CONNECTED', nullable=False),
        sa.Column('quality_rating', sa.String(length=50), server_default='UNKNOWN', nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('connected_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint('gym_id', 'phone_number_id', name='uq_gym_phone_number')
    )
    op.create_index(op.f('ix_whatsapp_integrations_id'), 'whatsapp_integrations', ['id'], unique=False)
    op.create_index(op.f('ix_whatsapp_integrations_gym_id'), 'whatsapp_integrations', ['gym_id'], unique=False)
    op.create_index(op.f('ix_whatsapp_integrations_phone_number_id'), 'whatsapp_integrations', ['phone_number_id'], unique=False)

    # 2. Add multi-tenant columns to notifications table
    op.add_column('notifications', sa.Column('integration_id', sa.Integer(), sa.ForeignKey('whatsapp_integrations.id', ondelete='SET NULL'), nullable=True))
    op.add_column('notifications', sa.Column('provider_message_id', sa.String(length=100), nullable=True))
    op.add_column('notifications', sa.Column('delivery_status', sa.String(length=50), nullable=True))
    op.add_column('notifications', sa.Column('error_code', sa.String(length=50), nullable=True))
    op.add_column('notifications', sa.Column('metadata_json', sa.Text(), nullable=True))

    op.create_index(op.f('ix_notifications_integration_id'), 'notifications', ['integration_id'], unique=False)
    op.create_index(op.f('ix_notifications_provider_message_id'), 'notifications', ['provider_message_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_provider_message_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_integration_id'), table_name='notifications')
    op.drop_column('notifications', 'metadata_json')
    op.drop_column('notifications', 'error_code')
    op.drop_column('notifications', 'delivery_status')
    op.drop_column('notifications', 'provider_message_id')
    op.drop_column('notifications', 'integration_id')

    op.drop_index(op.f('ix_whatsapp_integrations_phone_number_id'), table_name='whatsapp_integrations')
    op.drop_index(op.f('ix_whatsapp_integrations_gym_id'), table_name='whatsapp_integrations')
    op.drop_index(op.f('ix_whatsapp_integrations_id'), table_name='whatsapp_integrations')
    op.drop_table('whatsapp_integrations')
