from app.database.database import SessionLocal
from app.models.user import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()
from sqlalchemy import text
db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
email = "merwilcompany@zonafit.com"

# Check if exists
user = db.query(User).filter(User.email == email).first()
if not user:
    new_user = User(
        email=email,
        full_name="Super Admin",
        password=pwd_context.hash("Company*1597"),
        role="SUPERADMIN",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    print("Superadmin created")
else:
    user.password = pwd_context.hash("Company*1597")
    user.role = "SUPERADMIN"
    db.commit()
    print("Superadmin updated")

db.close()
