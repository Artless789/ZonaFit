"""standardize_payment_methods

Revision ID: d1e2f3a4b5c6
Revises: c3d4e5f6a7b8
Create Date: 2026-09-06 08:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Bypass RLS if postgresql
    if dialect == 'postgresql':
        try:
            op.execute("SELECT set_config('app.bypass_rls', 'on', true);")
        except Exception:
            pass

    # Standardize historical digital wallet payments (NEQUI, DAVIPLATA) to TRANSFER
    op.execute("""
        UPDATE payments
        SET payment_method = 'TRANSFER'
        WHERE UPPER(payment_method) IN ('NEQUI', 'DAVIPLATA');
    """)

def downgrade() -> None:
    # Historical digital wallets cannot be differentiated once merged into TRANSFER
    pass
