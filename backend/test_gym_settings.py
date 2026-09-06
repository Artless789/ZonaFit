"""
Pruebas funcionales - Modulo: Gym Settings
Ejecutar desde: C:/Dev/ZonaFit/backend
Comando: .\\venv\\Scripts\\python.exe test_gym_settings.py

NOTA: Cada test abre y cierra su propia sesion de base de datos para evitar
conflictos con el ciclo de vida de DatabaseTransaction (que cierra la sesion
tras cada operacion). Esto es especifico del entorno de test; en FastAPI cada
request maneja su propia sesion de forma correcta.
"""

import sys
from decimal import Decimal

from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym_settings import GymSettings
from app.schemas.gym_settings import GymSettingsCreate, GymSettingsUpdate
from app.services.gym_settings_service import GymSettingsService
from app.exceptions.not_found_exception import NotFoundException
from app.exceptions.conflict_exception import ConflictException

ADMIN_EMAIL = "admin@merwilfit.com"

PASS_COUNT = 0
FAIL_COUNT = 0


def log(label: str, passed: bool, detail: str = "") -> None:
    global PASS_COUNT, FAIL_COUNT
    icon = "[OK]" if passed else "[FAIL]"
    suffix = f" -> {detail}" if detail else ""
    print(f"  {icon}  {label}{suffix}")
    if passed:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1


def create_test_session(gym_id: int | None = None) -> SessionLocal:
    db = SessionLocal()
    db.info['bypass_rls'] = True
    if gym_id:
        db.info['tenant_id'] = gym_id
    return db


def get_admin_info() -> tuple[int, int]:
    db = create_test_session()
    try:
        user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user:
            user = db.query(User).filter(User.role.in_(["ADMIN", "OWNER"]), User.gym_id.isnot(None)).first()
        if not user:
            from app.models.gym import Gym
            gym = db.query(Gym).first()
            if not gym:
                gym = Gym(name="Test Gym Settings", document_number="900000000", address="Calle 1", phone="123")
                db.add(gym)
                db.commit()
                db.refresh(gym)
            user = User(full_name="Test Admin", email="test_admin_settings@zonafit.co", password="xxx", role="ADMIN", gym_id=gym.id)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user.id, user.gym_id
    finally:
        db.close()


def fetch_settings(gym_id: int):
    db = create_test_session(gym_id)
    try:
        return db.query(GymSettings).filter(GymSettings.gym_id == gym_id).first()
    finally:
        db.close()


def cleanup(gym_id: int) -> None:
    db = create_test_session(gym_id)
    try:
        db.query(GymSettings).filter(GymSettings.gym_id == gym_id).delete()
        db.commit()
    finally:
        db.close()


VALID_PAYLOAD = dict(
    legal_name="Gimnasio Central S.A.S.",
    trade_name="ZonaFit Centro",
    tax_id="900123456-7",
    tax_regime="Regimen Simple",
    official_phone="3001234567",
    official_email="info@zonafit.com",
    physical_address="Calle 10 # 20-30",
    city="Bogota",
    country="Colombia",
    currency="COP",
    timezone="America/Bogota",
    default_tax_percentage=Decimal("19.00"),
    receipt_footer_notes="Gracias por su compra.",
)


def run_tests() -> None:
    print("\n==========================================")
    print("  ZonaFit - Pruebas: Gym Settings")
    print("==========================================\n")

    user_id, gym_id = get_admin_info()
    cleanup(gym_id)

    # TEST 1: get sin registro -> NotFoundException
    print("[TEST 1] get_by_gym_id sin configuracion existente")
    db = create_test_session(gym_id)
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        GymSettingsService.get_by_gym_id(db, admin)
        log("Debe lanzar NotFoundException", False, "No se lanzo excepcion")
    except NotFoundException:
        log("Lanza NotFoundException correctamente", True)
    except Exception as e:
        log("Excepcion inesperada", False, str(e))
    finally:
        db.close()

    # TEST 2: create con datos validos (verificamos con query separado)
    print("\n[TEST 2] create con datos validos")
    db = create_test_session(gym_id)
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        GymSettingsService.create(db, admin, GymSettingsCreate(**VALID_PAYLOAD))
        log("Service.create ejecutado sin excepcion", True)
    except Exception as e:
        log("Error inesperado en create", False, str(e))
    finally:
        db.close()

    # Verificamos el registro con una sesion nueva
    created = fetch_settings(gym_id)
    log("Registro existe en BD", created is not None)
    if created:
        log("gym_id correcto", created.gym_id == gym_id)
        log("legal_name correcto", created.legal_name == "Gimnasio Central S.A.S.")
        log("currency correcto", created.currency == "COP")
        log("tax_percentage correcto", created.default_tax_percentage == Decimal("19.00"))

    # TEST 3: create duplicado -> ConflictException
    print("\n[TEST 3] create duplicado")
    db = create_test_session(gym_id)
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        GymSettingsService.create(db, admin, GymSettingsCreate(**VALID_PAYLOAD))
        log("Debe lanzar ConflictException", False, "No se lanzo excepcion")
    except ConflictException:
        log("Lanza ConflictException correctamente", True)
    except Exception as e:
        log("Excepcion inesperada", False, str(e))
    finally:
        db.close()

    # TEST 4: get con registro existente
    print("\n[TEST 4] get_by_gym_id con configuracion existente")
    db = create_test_session(gym_id)
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        fetched = GymSettingsService.get_by_gym_id(db, admin)
        log("Registro encontrado", fetched is not None)
        log("trade_name correcto", fetched.trade_name == "ZonaFit Centro")
    except Exception as e:
        log("Error inesperado en get", False, str(e))
    finally:
        db.close()

    # TEST 5: update parcial (verificamos con query separado)
    print("\n[TEST 5] update parcial (solo trade_name y city)")
    db = create_test_session(gym_id)
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        settings = GymSettingsService.get_by_gym_id(db, admin)
        GymSettingsService.update(
            db,
            settings,
            GymSettingsUpdate(trade_name="ZonaFit Norte", city="Medellin"),
        )
        log("Service.update ejecutado sin excepcion", True)
    except Exception as e:
        log("Error inesperado en update", False, str(e))
    finally:
        db.close()

    updated = fetch_settings(gym_id)
    if updated:
        log("trade_name actualizado", updated.trade_name == "ZonaFit Norte")
        log("city actualizado", updated.city == "Medellin")
        log("legal_name no modificado", updated.legal_name == "Gimnasio Central S.A.S.")

    # TEST 6: tax_percentage fuera de rango
    print("\n[TEST 6] validacion tax_percentage fuera de rango")
    try:
        GymSettingsCreate(**{**VALID_PAYLOAD, "default_tax_percentage": Decimal("150.00")})
        log("Debe fallar la validacion", False, "No se lanzo error")
    except ValueError:
        log("Pydantic rechaza tax_percentage=150.00", True)

    # TEST 7: currency invalida
    print("\n[TEST 7] validacion currency invalida")
    try:
        GymSettingsCreate(**{**VALID_PAYLOAD, "currency": "XYZ"})
        log("Debe fallar la validacion", False, "No se lanzo error")
    except ValueError:
        log("Pydantic rechaza currency='XYZ'", True)

    # TEST 8: email invalido
    print("\n[TEST 8] validacion email invalido")
    try:
        GymSettingsCreate(**{**VALID_PAYLOAD, "official_email": "no-es-un-email"})
        log("Debe fallar la validacion", False, "No se lanzo error")
    except ValueError:
        log("Pydantic rechaza email invalido", True)

    cleanup(gym_id)

    print("\n==========================================")
    print(f"  Resultado: {PASS_COUNT} pasaron | {FAIL_COUNT} fallaron")
    print("==========================================\n")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
