"""
Pruebas funcionales - Modulo: Audit Logs
Ejecutar desde: C:/Dev/ZonaFit/backend
Comando: .\\venv\\Scripts\\python.exe test_audit_logs.py
"""

import sys

from app.database.database import SessionLocal
from app.models.user import User
from app.models.audit_log import AuditLog
from app.constants.audit_actions import AuditAction
from app.services.audit_service import AuditService
from app.schemas.pagination import PaginationParams
from app.schemas.sort import SortParams

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


def get_admin_info() -> tuple[int, int]:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not user:
            print(f"\n[ERROR] No se encontro un usuario con email '{ADMIN_EMAIL}'.")
            sys.exit(1)
        return user.id, user.gym_id
    finally:
        db.close()


def cleanup(gym_id: int) -> None:
    db = SessionLocal()
    try:
        db.query(AuditLog).filter(AuditLog.gym_id == gym_id).delete()
        db.commit()
    finally:
        db.close()


def run_tests() -> None:
    print("\n==========================================")
    print("  ZonaFit - Pruebas: Audit Logs")
    print("==========================================\n")

    user_id, gym_id = get_admin_info()
    cleanup(gym_id)

    # TEST 1: AuditService.log() inserta un registro correctamente
    print("[TEST 1] AuditService.log() inserta entrada en BD")
    db = SessionLocal()
    try:
        AuditService.log(
            db=db,
            gym_id=gym_id,
            user_id=user_id,
            action=AuditAction.CREATE,
            entity_type="GymSettings",
            entity_id=1,
            new_values={"trade_name": "ZonaFit Centro"},
        )
        db.commit()
        count = db.query(AuditLog).filter(AuditLog.gym_id == gym_id).count()
        log("Registro insertado en BD", count == 1, f"count={count}")
    except Exception as e:
        log("Error inesperado en log()", False, str(e))
    finally:
        db.close()

    # TEST 2: log() con old_values y new_values (UPDATE)
    print("\n[TEST 2] log() registra old_values y new_values")
    db = SessionLocal()
    try:
        AuditService.log(
            db=db,
            gym_id=gym_id,
            user_id=user_id,
            action=AuditAction.UPDATE,
            entity_type="GymSettings",
            entity_id=1,
            old_values={"city": "Bogota"},
            new_values={"city": "Medellin"},
        )
        db.commit()
        entry = (
            db.query(AuditLog)
            .filter(AuditLog.action == AuditAction.UPDATE)
            .first()
        )
        log("Entrada UPDATE encontrada", entry is not None)
        if entry:
            log("old_values correcto", entry.old_values == {"city": "Bogota"})
            log("new_values correcto", entry.new_values == {"city": "Medellin"})
    except Exception as e:
        log("Error inesperado", False, str(e))
    finally:
        db.close()

    # TEST 3: log() sin user_id (evento de sistema)
    print("\n[TEST 3] log() sin user_id (evento de sistema)")
    db = SessionLocal()
    try:
        AuditService.log(
            db=db,
            gym_id=gym_id,
            action=AuditAction.LOGIN_FAILED,
            entity_type="User",
            ip_address="192.168.1.1",
        )
        db.commit()
        entry = (
            db.query(AuditLog)
            .filter(AuditLog.action == AuditAction.LOGIN_FAILED)
            .first()
        )
        log("Entrada sin user_id insertada", entry is not None)
        if entry:
            log("user_id es None", entry.user_id is None)
            log("ip_address correcto", entry.ip_address == "192.168.1.1")
    except Exception as e:
        log("Error inesperado", False, str(e))
    finally:
        db.close()

    # TEST 4: get_all retorna entradas del gym correcto (aislamiento tenant)
    print("\n[TEST 4] get_all - aislamiento por gym_id")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        result = AuditService.get_all(
            db=db,
            current_user=admin,
            sort=SortParams(),
            params=PaginationParams(),
        )
        log("get_all retorna resultados", result.total > 0, f"total={result.total}")
        log("Todas las entradas son del gym correcto",
            all(i.gym_id == gym_id for i in result.items))
    except Exception as e:
        log("Error inesperado en get_all", False, str(e))
    finally:
        db.close()

    # TEST 5: filtro por action
    print("\n[TEST 5] filtro por action=CREATE")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        result = AuditService.get_all(
            db=db,
            current_user=admin,
            sort=SortParams(),
            params=PaginationParams(),
            action="CREATE",
        )
        log("Solo retorna entradas CREATE",
            all(i.action == "CREATE" for i in result.items),
            f"count={result.total}")
    except Exception as e:
        log("Error inesperado en filtro por action", False, str(e))
    finally:
        db.close()

    # TEST 6: filtro por entity_type
    print("\n[TEST 6] filtro por entity_type=GymSettings")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        result = AuditService.get_all(
            db=db,
            current_user=admin,
            sort=SortParams(),
            params=PaginationParams(),
            entity_type="GymSettings",
        )
        log("Solo retorna entradas de GymSettings",
            all(i.entity_type == "GymSettings" for i in result.items),
            f"count={result.total}")
    except Exception as e:
        log("Error inesperado en filtro por entity_type", False, str(e))
    finally:
        db.close()

    # TEST 7: get_by_id retorna entrada correcta
    print("\n[TEST 7] get_by_id retorna entrada correcta")
    db = SessionLocal()
    try:
        first = db.query(AuditLog).filter(AuditLog.gym_id == gym_id).first()
        admin = db.query(User).filter(User.id == user_id).first()
        entry = AuditService.get_by_id(db, admin, first.id)
        log("Entrada encontrada por ID", entry is not None)
        if entry:
            log("ID correcto", entry.id == first.id)
    except Exception as e:
        log("Error inesperado en get_by_id", False, str(e))
    finally:
        db.close()

    # TEST 8: get_by_id con ID inexistente retorna None
    print("\n[TEST 8] get_by_id con ID inexistente")
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        entry = AuditService.get_by_id(db, admin, 999999)
        log("Retorna None para ID inexistente", entry is None)
    except Exception as e:
        log("Error inesperado", False, str(e))
    finally:
        db.close()

    cleanup(gym_id)

    print("\n==========================================")
    print(f"  Resultado: {PASS_COUNT} pasaron | {FAIL_COUNT} fallaron")
    print("==========================================\n")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
