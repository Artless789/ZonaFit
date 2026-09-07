"""seed superadmin user merwilcompany

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-06 23:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SUPERADMIN_EMAIL = "merwilcompany@zonafit.com"
SUPERADMIN_PASSWORD_PLAIN = "Company*1597"


def upgrade() -> None:
    # 1. Bypass RLS so migration can inspect and update users globally
    op.execute(sa.text("SELECT set_config('app.bypass_rls', 'on', true);"))

    # 2. Compute secure hash
    hashed_password = pwd_context.hash(SUPERADMIN_PASSWORD_PLAIN)

    conn = op.get_bind()

    # 3. Check if user already exists
    res = conn.execute(
        sa.text("SELECT id FROM users WHERE email = :email"),
        {"email": SUPERADMIN_EMAIL}
    ).fetchone()

    if res:
        conn.execute(
            sa.text("""
                UPDATE users 
                SET password = :password,
                    role = 'SUPERADMIN',
                    is_active = true,
                    gym_id = NULL,
                    full_name = 'Super Admin'
                WHERE email = :email
            """),
            {
                "password": hashed_password,
                "email": SUPERADMIN_EMAIL
            }
        )
    else:
        conn.execute(
            sa.text("""
                INSERT INTO users (full_name, email, password, role, is_active, gym_id)
                VALUES ('Super Admin', :email, :password, 'SUPERADMIN', true, NULL)
            """),
            {
                "email": SUPERADMIN_EMAIL,
                "password": hashed_password
            }
        )


def downgrade() -> None:
    # Do not delete the superadmin on downgrade to prevent accidental data loss in production
    pass
