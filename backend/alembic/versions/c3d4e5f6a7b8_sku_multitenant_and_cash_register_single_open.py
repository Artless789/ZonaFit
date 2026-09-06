"""sku_multitenant_and_cash_register_single_open

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-05 20:05:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None

def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Products: drop global unique on sku, add composite unique on (gym_id, sku)
    if dialect == 'postgresql':
        op.drop_constraint('products_sku_key', 'products', type_='unique')
        op.create_unique_constraint('uq_gym_product_sku', 'products', ['gym_id', 'sku'])
    elif dialect == 'sqlite':
        with op.batch_alter_table('products') as batch_op:
            batch_op.create_unique_constraint('uq_gym_product_sku', ['gym_id', 'sku'])
    else:
        try:
            op.drop_constraint('products_sku_key', 'products', type_='unique')
        except Exception:
            pass
        op.create_unique_constraint('uq_gym_product_sku', 'products', ['gym_id', 'sku'])

    # 2. Cash Registers: auto-close any historical duplicate open registers to ensure clean index
    try:
        if dialect == 'postgresql':
            op.execute("""
                UPDATE cash_registers
                SET status = 'CLOSED', closed_at = NOW(), closing_notes = 'Auto-closed duplicate open register during migration'
                WHERE status = 'OPEN'
                AND id NOT IN (
                    SELECT MAX(id)
                    FROM cash_registers
                    WHERE status = 'OPEN'
                    GROUP BY gym_id
                )
            """)
    except Exception:
        pass

    # 3. Cash Registers: partial unique index for single OPEN register per gym
    op.create_index(
        'uq_gym_active_cash_register',
        'cash_registers',
        ['gym_id'],
        unique=True,
        postgresql_where=sa.text("status = 'OPEN'"),
        sqlite_where=sa.text("status = 'OPEN'")
    )

def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Drop partial index
    op.drop_index('uq_gym_active_cash_register', table_name='cash_registers')

    # Revert product SKU constraint
    if dialect == 'postgresql':
        op.drop_constraint('uq_gym_product_sku', 'products', type_='unique')
        op.create_unique_constraint('products_sku_key', 'products', ['sku'])
    elif dialect == 'sqlite':
        with op.batch_alter_table('products') as batch_op:
            batch_op.drop_constraint('uq_gym_product_sku', type_='unique')
    else:
        op.drop_constraint('uq_gym_product_sku', 'products', type_='unique')
        op.create_unique_constraint('products_sku_key', 'products', ['sku'])
