import sys
sys.path.append('.')
from app.database.database import SessionLocal
from sqlalchemy import text

def run():
    db = SessionLocal()
    
    tables = db.execute(text("SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")).fetchall()
    print("=== TABLES ===")
    for t in tables:
        print(t)
        
    schema_owner = db.execute(text("SELECT nspname, rolname FROM pg_namespace JOIN pg_roles ON pg_namespace.nspowner = pg_roles.oid WHERE nspname = 'public';")).fetchall()
    print("\n=== SCHEMA PUBLIC ===")
    for s in schema_owner:
        print(s)
        
    current_user = db.execute(text("SELECT current_user;")).scalar()
    print(f"\n=== CURRENT USER ===\n{current_user}")
    
    roles = db.execute(text("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'zonafit_app';")).fetchall()
    print("\n=== ROLES ===")
    for r in roles:
        print(r)
        
    privileges = db.execute(text("SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE grantee = 'zonafit_app' AND table_name = 'users';")).fetchall()
    print("\n=== PRIVILEGES ON USERS ===")
    for p in privileges:
        print(p)
        
    db.close()

if __name__ == '__main__':
    run()
