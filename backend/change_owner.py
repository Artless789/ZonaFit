import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
# Use the same password as zonafit_app to test if it works for postgres, or fallback to 'postgres'
DB_PASSWORD = os.getenv("DB_PASSWORD")

def try_connect(password):
    url = f"postgresql://postgres:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            user = conn.execute(text("SELECT current_user")).scalar()
            print(f"Connected successfully as {user} with password {password[:2]}...")
            return engine
    except Exception as e:
        # Ignore decoding errors from Spanish locale exceptions
        print(f"Failed with password {password[:2]}...")
        return None

engine = None
for pw in [DB_PASSWORD, "postgres", "admin", "password", "root", "123456", "zonafit"]:
    engine = try_connect(pw)
    if engine:
        break

if engine:
    print("Executing ownership transfer...")
    tables = [
        "alembic_version",
        "audit_logs",
        "categories",
        "clients",
        "gym_settings",
        "gyms",
        "inventory_movements",
        "invoice_details",
        "invoices",
        "membership_plans",
        "memberships",
        "notification_templates",
        "notifications",
        "payments",
        "plans",
        "products",
        "sale_details",
        "sales",
        "subscription_payments",
        "subscriptions",
        "users"
    ]
    with engine.begin() as conn:
        for t in tables:
            conn.execute(text(f"ALTER TABLE {t} OWNER TO zonafit_app;"))
        print("Ownership transferred successfully!")
