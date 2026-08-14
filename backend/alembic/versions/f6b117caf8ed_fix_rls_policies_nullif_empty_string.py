"""fix rls policies nullif empty string

Revision ID: f6b117caf8ed
Revises: ca422964a9ab
Create Date: 2026-08-08 13:17:25.305710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6b117caf8ed'
down_revision: Union[str, Sequence[str], None] = 'ca422964a9ab'
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
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        policy_sql = f"""
        CREATE POLICY tenant_isolation_policy ON {table}
        FOR ALL
        USING (
            gym_id = nullif(current_setting('app.current_gym_id', true), '')::integer 
            OR nullif(current_setting('app.bypass_rls', true), '') = 'on'
        )
        WITH CHECK (
            gym_id = nullif(current_setting('app.current_gym_id', true), '')::integer 
            OR nullif(current_setting('app.bypass_rls', true), '') = 'on'
        );
        """
        op.execute(policy_sql)


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
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
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
