"""Enable RLS for cash registers and movements

Revision ID: 3f35b3339b7a
Revises: 737c517d2d1b
Create Date: 2026-08-09 13:23:12.632585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f35b3339b7a'
down_revision: Union[str, Sequence[str], None] = '737c517d2d1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    tables = [
        "cash_registers",
        "cash_movements"
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
        "cash_registers",
        "cash_movements"
    ]
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
