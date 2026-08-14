import sys
sys.path.append('.')
from app.database.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.execute(text("SELECT set_config('app.current_gym_id', 'None', true)"))
    val_int = db.execute(text("SELECT current_setting('app.current_gym_id', true)::integer")).scalar()
    print(f"Int Value: {val_int!r}")
except Exception as e:
    print(f"Error: {e}")
db.close()
