"""
Pruebas funcionales - Modulo: Notificaciones y WhatsApp
Ejecutar desde: C:/Dev/ZonaFit/backend
Comando: .\\venv\\Scripts\\python.exe test_notifications.py
"""

import sys

from starlette.testclient import TestClient

from app.database.database import SessionLocal
from app.main import app
from app.models.user import User
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.constants.notification_channels import NotificationChannel
from app.constants.notification_event_types import NotificationEventType
from app.constants.notification_statuses import NotificationStatus
from app.schemas.notification_template import NotificationTemplateCreate, NotificationTemplateUpdate
from app.services.notification_template_service import NotificationTemplateService
from app.services.notification_service import NotificationService
from app.services.whatsapp_sender import WhatsAppSender
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
            print(f"\n[ERROR] No se encontro usuario con email '{ADMIN_EMAIL}'.")
            sys.exit(1)
        return user.id, user.gym_id
    finally:
        db.close()


def get_admin_token() -> str:
    client = TestClient(app)
    resp = client.post(
        "/auth/login",
        data={"username": ADMIN_EMAIL, "password": "admin123"},
    )
    token = resp.json().get("access_token")
    if not token:
        print(f"\n[ERROR] No se pudo obtener token. Verifica la password del admin.")
        print(f"  Respuesta: {resp.json()}")
        sys.exit(1)
    return token


def cleanup(gym_id: int) -> None:
    db = SessionLocal()
    try:
        db.query(Notification).filter(Notification.gym_id == gym_id).delete()
        db.query(NotificationTemplate).filter(NotificationTemplate.gym_id == gym_id).delete()
        db.commit()
    finally:
        db.close()


def run_tests() -> None:
    print("\n==========================================")
    print("  ZonaFit - Pruebas: Notificaciones")
    print("==========================================\n")

    user_id, gym_id = get_admin_info()
    cleanup(gym_id)

    # ── BLOQUE 1: WhatsApp Sender ──────────────────────────────────────────────
    print("[BLOQUE 1] WhatsApp Sender")

    log("is_configured() retorna False sin credenciales", not WhatsAppSender.is_configured())

    try:
        WhatsAppSender.send_text("573000000000", "test")
        log("Debe lanzar ValueError sin credenciales", False)
    except ValueError as e:
        log("Lanza ValueError al enviar sin credenciales", True, str(e)[:60])

    # ── BLOQUE 2: Notification Template CRUD ──────────────────────────────────
    print("\n[BLOQUE 2] Notification Template CRUD")

    # Crear template
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        data = NotificationTemplateCreate(
            event_type=NotificationEventType.MEMBERSHIP_EXPIRY,
            channel=NotificationChannel.WHATSAPP,
            template_body=(
                "Hola {client_name}, tu membresia en {gym_name} vence el {expiry_date}. "
                "Renuevala y sigue entrenando."
            ),
        )
        NotificationTemplateService.create(db, admin, data)
        log("Template creado", True)
    except Exception as e:
        log("Error al crear template", False, str(e))
    finally:
        db.close()

    # Verificar en BD
    db = SessionLocal()
    tmpl = (
        db.query(NotificationTemplate)
        .filter(
            NotificationTemplate.gym_id == gym_id,
            NotificationTemplate.event_type == NotificationEventType.MEMBERSHIP_EXPIRY,
        )
        .first()
    )
    log("Template existe en BD", tmpl is not None)
    tmpl_id = tmpl.id if tmpl else None
    log("is_active=True por defecto", tmpl is not None and tmpl.is_active is True)
    db.close()

    # Duplicado -> ConflictException
    from app.exceptions.conflict_exception import ConflictException
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.id == user_id).first()
        NotificationTemplateService.create(db, admin, data)
        log("Debe lanzar ConflictException en duplicado", False)
    except ConflictException:
        log("ConflictException en template duplicado", True)
    except Exception as e:
        log("Excepcion inesperada en duplicado", False, str(e))
    finally:
        db.close()

    # Actualizar template
    if tmpl_id:
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.id == user_id).first()
            tmpl = NotificationTemplateService.get_by_id(db, admin, tmpl_id)
            NotificationTemplateService.update(
                db, tmpl, NotificationTemplateUpdate(is_active=False)
            )
            log("Template desactivado sin error", True)
        except Exception as e:
            log("Error al desactivar template", False, str(e))
        finally:
            db.close()

        db = SessionLocal()
        reloaded = db.query(NotificationTemplate).filter(NotificationTemplate.id == tmpl_id).first()
        log("is_active=False en BD", reloaded is not None and reloaded.is_active is False)
        db.close()

    # ── BLOQUE 3: dispatch_from_template ───────────────────────────────────────
    print("\n[BLOQUE 3] dispatch_from_template")

    # Con template inactivo no debe crear notificacion
    db = SessionLocal()
    notif = NotificationService.dispatch_from_template(
        db=db,
        gym_id=gym_id,
        event_type=NotificationEventType.MEMBERSHIP_EXPIRY,
        channel=NotificationChannel.WHATSAPP,
        recipient="573000000000",
        context={"client_name": "Juan", "gym_name": "ZonaFit", "expiry_date": "2026-09-01"},
    )
    db.close()
    log("Sin template activo retorna None", notif is None)

    # Reactivar template y probar dispatch
    if tmpl_id:
        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.id == user_id).first()
            t = NotificationTemplateService.get_by_id(db, admin, tmpl_id)
            NotificationTemplateService.update(db, t, NotificationTemplateUpdate(is_active=True))
        except Exception as e:
            log("Error al reactivar", False, str(e))
        finally:
            db.close()

    db = SessionLocal()
    notif = NotificationService.dispatch_from_template(
        db=db,
        gym_id=gym_id,
        event_type=NotificationEventType.MEMBERSHIP_EXPIRY,
        channel=NotificationChannel.WHATSAPP,
        recipient="573000000000",
        context={"client_name": "Juan", "gym_name": "ZonaFit", "expiry_date": "2026-09-01"},
    )
    db.close()
    log("Con template activo crea notificacion", notif is not None)
    if notif:
        log("Estado inicial = PENDING", notif.status == NotificationStatus.PENDING)
        log("Variables renderizadas correctamente",
            "Juan" in notif.message_body and "ZonaFit" in notif.message_body)

    # ── BLOQUE 4: send_and_update marca FAILED sin credenciales ───────────────
    print("\n[BLOQUE 4] send_and_update")

    if notif:
        NotificationService.send_and_update(notif.id)
        db = SessionLocal()
        reloaded = db.query(Notification).filter(Notification.id == notif.id).first()
        db.close()
        log("Estado actualizado a FAILED (sin credenciales)", reloaded.status == NotificationStatus.FAILED)
        log("error_detail no es None", reloaded.error_detail is not None)

    # ── BLOQUE 5: dispatch manual + listado via servicio ──────────────────────
    print("\n[BLOQUE 5] dispatch manual y listado")

    db = SessionLocal()
    n = NotificationService.dispatch(
        db=db,
        gym_id=gym_id,
        event_type=NotificationEventType.GENERAL,
        channel=NotificationChannel.WHATSAPP,
        recipient="573001111111",
        message_body="Mensaje de prueba manual.",
    )
    dispatch_id = n.id
    db.close()
    log("dispatch() crea notificacion PENDING", n.status == NotificationStatus.PENDING)

    db = SessionLocal()
    admin = db.query(User).filter(User.id == user_id).first()
    result = NotificationService.get_all(
        db=db,
        current_user=admin,
        params=PaginationParams(),
        sort=SortParams(),
    )
    db.close()
    log("get_all retorna notificaciones", result.total > 0, f"total={result.total}")
    log("Todas pertenecen al gym", all(i.gym_id == gym_id for i in result.items))

    # Filtro por status=PENDING
    db = SessionLocal()
    admin = db.query(User).filter(User.id == user_id).first()
    pending = NotificationService.get_all(
        db=db,
        current_user=admin,
        params=PaginationParams(),
        sort=SortParams(),
        status="PENDING",
    )
    db.close()
    log("Filtro status=PENDING funciona", all(i.status == "PENDING" for i in pending.items))

    # ── BLOQUE 6: Pydantic validaciones ───────────────────────────────────────
    print("\n[BLOQUE 6] Validaciones Pydantic")

    from app.schemas.notification import NotificationSendRequest
    try:
        NotificationSendRequest(
            event_type="INVALID_EVENT",
            channel="WHATSAPP",
            recipient="573001234567",
            message_body="test",
        )
        log("Debe rechazar event_type invalido", False)
    except ValueError:
        log("Rechaza event_type invalido", True)

    try:
        NotificationSendRequest(
            event_type=NotificationEventType.GENERAL,
            channel="EMAIL",
            recipient="573001234567",
            message_body="test",
        )
        log("Debe rechazar channel EMAIL (no soportado)", False)
    except ValueError:
        log("Rechaza channel no soportado", True)

    try:
        NotificationSendRequest(
            event_type=NotificationEventType.GENERAL,
            channel="WHATSAPP",
            recipient="  ",
            message_body="test",
        )
        log("Debe rechazar recipient vacio", False)
    except ValueError:
        log("Rechaza recipient vacio", True)

    # ── Limpieza ───────────────────────────────────────────────────────────────
    cleanup(gym_id)

    print("\n==========================================")
    print(f"  Resultado: {PASS_COUNT} pasaron | {FAIL_COUNT} fallaron")
    print("==========================================\n")

    if FAIL_COUNT > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
