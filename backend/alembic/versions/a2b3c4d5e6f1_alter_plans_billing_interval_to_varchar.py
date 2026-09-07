"""alter plans billing_interval to varchar

Revision ID: a2b3c4d5e6f1
Revises: f1e2a3b4c5d6
Create Date: 2026-09-06 22:48:00.000000

"""
from typing import Sequence, Union
from alembic import context, op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f1'
down_revision: Union[str, None] = 'f1e2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not context.is_offline_mode():
        bind = op.get_bind()
        if bind is not None and bind.dialect.name == 'sqlite':
            with op.batch_alter_table('plans') as batch_op:
                batch_op.alter_column('billing_interval', type_=sa.String(30), server_default='MONTHLY')
            return

    op.execute(sa.text("""
        DO $$
        BEGIN
            -- 1. Detectar el tipo real de la columna en el esquema actual y migrar a VARCHAR(30)
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'plans' 
                  AND column_name = 'billing_interval' 
                  AND table_schema = current_schema()
                  AND udt_name = 'billinginterval'
            ) THEN
                ALTER TABLE plans ALTER COLUMN billing_interval DROP DEFAULT;
                ALTER TABLE plans ALTER COLUMN billing_interval TYPE VARCHAR(30) USING billing_interval::text;
                ALTER TABLE plans ALTER COLUMN billing_interval SET DEFAULT 'MONTHLY';
            ELSE
                ALTER TABLE plans ALTER COLUMN billing_interval TYPE VARCHAR(30);
                ALTER TABLE plans ALTER COLUMN billing_interval SET DEFAULT 'MONTHLY';
            END IF;

            -- 2. Intentar eliminar de forma segura el tipo enum únicamente si no tiene dependencias
            IF EXISTS (
                SELECT 1 
                FROM pg_type t
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE t.typname = 'billinginterval'
                  AND n.nspname = current_schema()
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_attribute a 
                    JOIN pg_type t ON a.atttypid = t.oid 
                    JOIN pg_namespace n ON t.typnamespace = n.oid
                    WHERE t.typname = 'billinginterval'
                      AND n.nspname = current_schema()
                      AND a.attnum > 0
                      AND NOT a.attisdropped
                ) THEN
                    BEGIN
                        DROP TYPE billinginterval;
                    EXCEPTION
                        WHEN insufficient_privilege OR dependent_objects_still_exist THEN
                            -- Si el usuario de la migración no es el propietario del tipo
                            -- o persisten dependencias externas, se preserva el tipo sin abortar
                            NULL;
                    END;
                END IF;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    if not context.is_offline_mode():
        bind = op.get_bind()
        if bind is not None and bind.dialect.name == 'sqlite':
            with op.batch_alter_table('plans') as batch_op:
                batch_op.alter_column('billing_interval', type_=sa.Enum('MONTHLY', 'YEARLY', name='billinginterval'), server_default='MONTHLY')
            return

    op.execute(sa.text("""
        DO $$
        BEGIN
            -- 1. Recrear el tipo enum original si no existe en el esquema actual
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_type t
                JOIN pg_namespace n ON t.typnamespace = n.oid
                WHERE t.typname = 'billinginterval'
                  AND n.nspname = current_schema()
            ) THEN
                CREATE TYPE billinginterval AS ENUM ('MONTHLY', 'YEARLY');
            END IF;

            -- 2. Desvincular default antes de la conversión
            ALTER TABLE plans ALTER COLUMN billing_interval DROP DEFAULT;

            -- 3. Reconvertir a enum mapeando valores distintos de YEARLY a MONTHLY
            ALTER TABLE plans ALTER COLUMN billing_interval TYPE billinginterval USING (
                CASE 
                    WHEN billing_interval = 'YEARLY' THEN 'YEARLY'::billinginterval
                    ELSE 'MONTHLY'::billinginterval
                END
            );

            -- 4. Restablecer default como enum
            ALTER TABLE plans ALTER COLUMN billing_interval SET DEFAULT 'MONTHLY'::billinginterval;
        END $$;
    """))
