from app.database.database import SessionLocal
from app.models import Gym, User

db = SessionLocal()

try:
    gym = Gym(
        name="MerwilFit",
        email="contacto@merwilfit.com",
        phone="3001234567",
        address="Valledupar"
    )

    db.add(gym)
    db.commit()
    db.refresh(gym)

    user = User(
        gym_id=gym.id,
        full_name="Juan Administrador",
        email="admin@merwilfit.com",
        password="123456",
        role="ADMIN"
    )

    db.add(user)
    db.commit()

    usuario = db.query(User).first()

    print("Usuario:", usuario.full_name)
    print("Gimnasio:", usuario.gym.name)

finally:
    db.close()