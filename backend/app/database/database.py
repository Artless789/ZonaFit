from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

from app.database.base import Base

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=os.getenv("SQL_ECHO", "False").lower() == "true",
)

from sqlalchemy import event
from sqlalchemy.orm import Session

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

@event.listens_for(Session, "after_begin")
def receive_after_begin(session, transaction, connection):
    tenant_id = session.info.get('tenant_id')
    bypass = session.info.get('bypass_rls')
    
    try:
        from sqlalchemy import text
        if bypass:
            connection.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        elif tenant_id:
            connection.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(tenant_id)})
    except Exception:
        pass

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()