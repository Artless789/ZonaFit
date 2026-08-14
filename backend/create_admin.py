from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


db: Session = SessionLocal()

try:
    user = db.query(User).filter(User.email == "admin@merwilfit.com").first()

    if user:
        user.password = hash_password("123456")
        db.commit()

        print("Contraseña actualizada correctamente.")
    else:
        print("Usuario no encontrado.")

finally:
    db.close()