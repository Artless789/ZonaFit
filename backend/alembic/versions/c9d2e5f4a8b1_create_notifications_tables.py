"""create notifications tables

Revision ID: c9d2e5f4a8b1
Revises: b7e4f1a23c89
Create Date: 2026-08-07 12:04:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d2e5f4a8b1'
down_revision: Union[str, Sequence[str], None] = 'b7e4f1a23c89'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- notification_templates ---
    op.create_table(
        'notification_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gym_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('template_body', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['gym_id'], ['gyms.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('gym_id', 'event_type', 'channel', name='uq_template_gym_event_channel'),
    )
    op.create_index(op.f('ix_notification_templates_id'), 'notification_templates', ['id'], unique=False)
    op.create_index(op.f('ix_notification_templates_gym_id'), 'notification_templates', ['gym_id'], unique=False)

    # --- notifications ---
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('gym_id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('recipient', sa.String(length=100), nullable=False),
        sa.Column('message_body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_detail', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id']),
        sa.ForeignKeyConstraint(['gym_id'], ['gyms.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index(op.f('ix_notifications_gym_id'), 'notifications', ['gym_id'], unique=False)
    op.create_index(op.f('ix_notifications_client_id'), 'notifications', ['client_id'], unique=False)
    op.create_index(op.f('ix_notifications_event_type'), 'notifications', ['event_type'], unique=False)
    op.create_index(op.f('ix_notifications_status'), 'notifications', ['status'], unique=False)
    op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_notifications_created_at'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_status'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_event_type'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_client_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_gym_id'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')

    op.drop_index(op.f('ix_notification_templates_gym_id'), table_name='notification_templates')
    op.drop_index(op.f('ix_notification_templates_id'), table_name='notification_templates')
    op.drop_table('notification_templates')
