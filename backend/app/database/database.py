from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

from app.database.base import Base

from pathlib import Path
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_HOST = os.getenv("DB_HOST") or os.getenv("\ufeffDB_HOST") or "localhost"
    DB_PORT = os.getenv("DB_PORT") or "5432"
    DB_NAME = os.getenv("DB_NAME") or "zonafit"
    DB_USER = os.getenv("DB_USER") or "zonafit_app"
    DB_PASSWORD = os.getenv("DB_PASSWORD") or ""
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Configuración conservadora del pool para VPS (1 vCPU / 2 GB RAM):
# - pool_pre_ping=True: valida que la conexión esté viva antes de entregarla al request
# - pool_recycle=1800: recicla conexiones cada 30 min antes de cortes por idle en red/VPS
# - pool_size=5 / max_overflow=5: acota conexiones concurrentes por worker sin saturar PostgreSQL
# - pool_timeout=10: espera máxima de 10s por una conexión libre en el pool
# - connect_timeout=5: espera máxima de 5s del driver psycopg2 al abrir conexión TCP con PostgreSQL
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_timeout=10,
    pool_recycle=1800,
    connect_args={"connect_timeout": 5},
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