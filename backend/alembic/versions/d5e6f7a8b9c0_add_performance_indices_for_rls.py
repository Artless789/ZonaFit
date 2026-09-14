"""add_performance_indices_for_rls

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-09-14 09:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Memberships indices
    op.create_index('ix_memberships_gym_id', 'memberships', ['gym_id'], unique=False)
    op.create_index('ix_memberships_client_id', 'memberships', ['client_id'], unique=False)
    op.create_index('ix_memberships_gym_status_created', 'memberships', ['gym_id', 'is_active', 'status', 'created_at'], unique=False)
    op.create_index('ix_memberships_gym_end_date', 'memberships', ['gym_id', 'end_date'], unique=False)

    # Payments indices
    op.create_index('ix_payments_gym_id', 'payments', ['gym_id'], unique=False)
    op.create_index('ix_payments_membership_id', 'payments', ['membership_id'], unique=False)
    op.create_index('ix_payments_sale_id', 'payments', ['sale_id'], unique=False)
    op.create_index('ix_payments_ar_id', 'payments', ['accounts_receivable_id'], unique=False)
    op.create_index('ix_payments_gym_status_created', 'payments', ['gym_id', 'is_active', 'status', 'created_at'], unique=False)

    # Sales indices
    op.create_index('ix_sales_gym_id', 'sales', ['gym_id'], unique=False)
    op.create_index('ix_sales_client_id', 'sales', ['client_id'], unique=False)
    op.create_index('ix_sales_gym_status_created', 'sales', ['gym_id', 'is_active', 'status', 'created_at'], unique=False)

    # Accounts Receivables indices
    op.create_index('ix_accounts_receivables_gym_id', 'accounts_receivables', ['gym_id'], unique=False)
    op.create_index('ix_accounts_receivables_client_id', 'accounts_receivables', ['client_id'], unique=False)
    op.create_index('ix_accounts_receivables_gym_balance', 'accounts_receivables', ['gym_id', 'is_active', 'balance_due'], unique=False)


def downgrade() -> None:
    # Accounts Receivables
    op.drop_index('ix_accounts_receivables_gym_balance', table_name='accounts_receivables')
    op.drop_index('ix_accounts_receivables_client_id', table_name='accounts_receivables')
    op.drop_index('ix_accounts_receivables_gym_id', table_name='accounts_receivables')

    # Sales
    op.drop_index('ix_sales_gym_status_created', table_name='sales')
    op.drop_index('ix_sales_client_id', table_name='sales')
    op.drop_index('ix_sales_gym_id', table_name='sales')

    # Payments
    op.drop_index('ix_payments_gym_status_created', table_name='payments')
    op.drop_index('ix_payments_ar_id', table_name='payments')
    op.drop_index('ix_payments_sale_id', table_name='payments')
    op.drop_index('ix_payments_membership_id', table_name='payments')
    op.drop_index('ix_payments_gym_id', table_name='payments')

    # Memberships
    op.drop_index('ix_memberships_gym_end_date', table_name='memberships')
    op.drop_index('ix_memberships_gym_status_created', table_name='memberships')
    op.drop_index('ix_memberships_client_id', table_name='memberships')
    op.drop_index('ix_memberships_gym_id', table_name='memberships')
