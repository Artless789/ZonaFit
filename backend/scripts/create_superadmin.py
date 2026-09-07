import os
import sys
import getpass

# Asegurar que el path alcance el directorio raíz
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password

def create_superadmin():
    print("========================================")
    print("   ZONAFIT - CREAR SUPERADMIN GLOBAL    ")
    print("========================================")
    print("Nota: Este usuario tendrá acceso total a la plataforma.\n")

    email = input("Email del superadmin: ").strip()
    if not email or "@" not in email:
        print("Error: Debe ingresar un correo válido.")
        return

    full_name = input("Nombre completo: ").strip()
    if not full_name:
        print("Error: El nombre es obligatorio.")
        return

    password = getpass.getpass("Contraseña: ")
    if len(password) < 6:
        print("Error: La contraseña debe tener al menos 6 caracteres.")
        return

    password_confirm = getpass.getpass("Confirmar contraseña: ")
    if password != password_confirm:
        print("Error: Las contraseñas no coinciden.")
        return

    print("\nProcesando...")

    db: Session = SessionLocal()
    try:
        from sqlalchemy import text, func
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        # Check if user already exists
        email = email.strip().lower()
        existing_user = db.query(User).filter(func.lower(func.trim(User.email)) == email).first()
        if existing_user:
            print(f"Error: El correo {email} ya está registrado.")
            return

        new_user = User(
            full_name=full_name.strip(),
            email=email,
            password=hash_password(password),
            role="SUPERADMIN",
            gym_id=None
        )
        db.add(new_user)
        db.commit()
        print(f"\n¡ÉXITO! Superadmin '{email}' creado correctamente.")
        print("Ahora puedes iniciar sesión en la plataforma.")
    except Exception as e:
        db.rollback()
        print(f"\nOcurrió un error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_superadmin()
