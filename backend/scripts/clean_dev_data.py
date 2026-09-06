import os
import sys
import argparse

# Ensure backend root is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")))

from sqlalchemy import inspect, text
from app.database.database import engine
from app.core.security import verify_password

REAL_SUPERADMIN_EMAIL = "merwilcompany@zonafit.com"

def run_cleanup(commit: bool = False):
    print("=" * 60)
    print("      MERWIL ZONAFIT - LIMPIEZA DE DATOS DE DESARROLLO      ")
    print("=" * 60)
    print(f"Modo: {'APLICAR CAMBIOS (COMMIT)' if commit else 'SIMULACIÓN (DRY RUN)'}")
    print(f"Superadmin a conservar: {REAL_SUPERADMIN_EMAIL}")
    print("-" * 60)

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Bypass RLS to ensure complete cleanup across all gyms
            conn.execute(text("SELECT set_config('app.bypass_rls', 'on', false)"))

            stats = {}

            # 1. Audit logs (all associated with test gyms)
            stats["audit_logs"] = conn.execute(text("DELETE FROM audit_logs WHERE gym_id IS NOT NULL")).rowcount

            # 2. Invoices & details
            stats["invoice_details"] = conn.execute(text("DELETE FROM invoice_details")).rowcount
            stats["invoices"] = conn.execute(text("DELETE FROM invoices")).rowcount

            # 3. Cash movements & registers
            stats["cash_movements"] = conn.execute(text("DELETE FROM cash_movements")).rowcount
            stats["cash_registers"] = conn.execute(text("DELETE FROM cash_registers")).rowcount

            # 4. Payments
            stats["payments"] = conn.execute(text("DELETE FROM payments")).rowcount

            # 5. Accounts receivables
            stats["accounts_receivables"] = conn.execute(text("DELETE FROM accounts_receivables")).rowcount

            # 6. Sale details & sales
            stats["sale_details"] = conn.execute(text("DELETE FROM sale_details")).rowcount
            stats["sales"] = conn.execute(text("DELETE FROM sales")).rowcount

            # 7. Inventory movements, products & categories
            stats["inventory_movements"] = conn.execute(text("DELETE FROM inventory_movements")).rowcount
            stats["products"] = conn.execute(text("DELETE FROM products")).rowcount
            stats["categories"] = conn.execute(text("DELETE FROM categories")).rowcount

            # 8. Notifications & templates
            stats["notifications"] = conn.execute(text("DELETE FROM notifications")).rowcount
            stats["notification_templates"] = conn.execute(text("DELETE FROM notification_templates")).rowcount

            # 9. Memberships & membership plans
            stats["memberships"] = conn.execute(text("DELETE FROM memberships")).rowcount
            stats["membership_plans"] = conn.execute(text("DELETE FROM membership_plans")).rowcount

            # 10. Clients
            stats["clients"] = conn.execute(text("DELETE FROM clients")).rowcount

            # 11. WhatsApp integrations
            stats["whatsapp_integrations"] = conn.execute(text("DELETE FROM whatsapp_integrations")).rowcount

            # 12. Gym settings
            stats["gym_settings"] = conn.execute(text("DELETE FROM gym_settings")).rowcount

            # 13. Subscriptions & subscription payments
            stats["subscription_payments"] = conn.execute(text("DELETE FROM subscription_payments")).rowcount
            stats["subscriptions"] = conn.execute(text("DELETE FROM subscriptions")).rowcount

            # 14. Password reset tokens & refresh tokens for test users
            stats["password_reset_tokens"] = conn.execute(
                text(f"DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email != '{REAL_SUPERADMIN_EMAIL}')")
            ).rowcount
            stats["refresh_tokens"] = conn.execute(
                text(f"DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email != '{REAL_SUPERADMIN_EMAIL}')")
            ).rowcount

            # 15. Break circular foreign key between gyms and users
            conn.execute(text("UPDATE gyms SET owner_id = NULL"))
            conn.execute(text("UPDATE users SET gym_id = NULL WHERE gym_id IS NOT NULL"))

            # 16. Delete test users (keep exclusively the real superadmin)
            stats["users"] = conn.execute(
                text(f"DELETE FROM users WHERE email != '{REAL_SUPERADMIN_EMAIL}'")
            ).rowcount

            # 17. Delete gyms
            stats["gyms"] = conn.execute(text("DELETE FROM gyms")).rowcount

            print("\n[REGISTROS ELIMINADOS]")
            for tbl, count in stats.items():
                print(f"  - {tbl}: {count}")

            # 18. Verification
            inspector = inspect(engine)
            all_tables = inspector.get_table_names()
            print("\n[ESTADO POST-LIMPIEZA DE TABLAS]")
            for t in sorted(all_tables):
                c = conn.execute(text(f"SELECT COUNT(*) FROM \"{t}\"")).scalar()
                print(f"  - {t}: {c}")

            # Verify Superadmin
            sa = conn.execute(
                text(f"SELECT id, email, full_name, role, is_active FROM users WHERE email = '{REAL_SUPERADMIN_EMAIL}'")
            ).fetchone()
            if sa:
                print(f"\n[SUPERADMIN CONSERVADO]: ID={sa[0]}, Email={sa[1]}, Nombre={sa[2]}, Rol={sa[3]}, Activo={sa[4]}")
            else:
                raise RuntimeError(f"CRITICAL ERROR: Superadmin '{REAL_SUPERADMIN_EMAIL}' not found!")

            # Verify commercial plans
            plans = conn.execute(text("SELECT id, name, price, currency, billing_interval FROM plans")).fetchall()
            print(f"[PLANES COMERCIALES CONSERVADOS]: {len(plans)} planes disponibles:")
            for p in plans:
                print(f"  - ID {p[0]}: {p[1]} ({p[3]} ${p[2]:,.0f} - {p[4]})")

            if commit:
                trans.commit()
                print("\n--> ÉXITO: Limpieza aplicada y confirmada permanentemente en la base de datos.")
            else:
                trans.rollback()
                print("\n--> SIMULACIÓN FINALIZADA: Transacción revertida (Rollback). Ningún dato fue modificado.")

        except Exception as e:
            trans.rollback()
            print(f"\n[ERROR CRÍTICO] La operación falló y se revirtió: {e}")
            raise e

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Limpieza segura de datos de desarrollo en Merwil ZonaFit.")
    parser.add_argument("--commit", action="store_true", help="Aplica los cambios permanentemente. Si no se indica, se ejecuta en modo simulación (Dry-Run).")
    args = parser.parse_args()
    run_cleanup(commit=args.commit)
