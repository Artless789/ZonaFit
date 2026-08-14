"""Enable RLS for multi-tenant isolation

Revision ID: ca422964a9ab
Revises: 7368ed916432
Create Date: 2026-08-08 12:37:22.611498

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca422964a9ab'
down_revision: Union[str, Sequence[str], None] = '7368ed916432'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    tables = [
        "audit_logs",
        "categories",
        "clients",
        "gym_settings",
        "inventory_movements",
        "invoices",
        "memberships",
        "membership_plans",
        "notifications",
        "notification_templates",
        "payments",
        "products",
        "sales",
        "subscriptions",
        "subscription_payments",
        "users"
    ]
    
    for table in tables:
        # Enable RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        # Drop existing policy if any (idempotency)
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        # Create the policy using current_setting with true (returns null if not set)
        policy_sql = f"""
        CREATE POLICY tenant_isolation_policy ON {table}
        FOR ALL
        USING (
            gym_id = current_setting('app.current_gym_id', true)::integer 
            OR current_setting('app.bypass_rls', true) = 'on'
        )
        WITH CHECK (
            gym_id = current_setting('app.current_gym_id', true)::integer 
            OR current_setting('app.bypass_rls', true) = 'on'
        );
        """
        op.execute(policy_sql)
        # Force RLS to apply even to the owner (zonafit_app) if it's the owner.
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Downgrade schema."""
    tables = [
        "audit_logs",
        "categories",
        "clients",
        "gym_settings",
        "inventory_movements",
        "invoices",
        "memberships",
        "membership_plans",
        "notifications",
        "notification_templates",
        "payments",
        "products",
        "sales",
        "subscriptions",
        "subscription_payments",
        "users"
    ]
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
