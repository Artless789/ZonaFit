import os
import json
import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.category import Category
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.whatsapp_integration import WhatsAppIntegration
from app.core.encryption import encrypt_token
from app.services.whatsapp_sender import WhatsAppSender
from app.services.notification_service import NotificationService, normalize_phone_co, is_valid_phone
from app.constants.notification_statuses import NotificationStatus
from app.constants.notification_channels import NotificationChannel
from app.constants.notification_event_types import NotificationEventType
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_whatsapp_p22.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == 'Connection':
        dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

current_test_user = None

def override_get_db():
    try:
        db = TestingSessionLocal()
        original_execute = db.execute
        def mock_execute(statement, *args, **kwargs):
            if isinstance(statement, str) and "set_config" in statement.lower():
                return
            if hasattr(statement, 'text') and "set_config" in statement.text.lower():
                return
            return original_execute(statement, *args, **kwargs)
        db.execute = mock_execute
        yield db
    finally:
        db.close()

def override_get_current_user():
    return current_test_user

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_whatsapp_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Alpha", email="alpha@gym.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Beta", email="beta@gym.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin Alpha", email="admin@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    staff1 = User(id=3, gym_id=1, full_name="Staff Alpha", email="staff@alpha.com", password=hash_password("Pass1234"), role="STAFF", is_active=True)
    db.add_all([user1, user2, staff1])
    db.commit()

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Carlos Gomez", document_type="CC", document="123456", phone="3001234567", email="carlos@gomez.com", is_active=True)
    client2 = Client(id=2, gym_id=1, full_name="Ana Sin Telefono", document_type="CC", document="654321", phone="", email="ana@gym.com", is_active=True)
    client_beta = Client(id=3, gym_id=2, full_name="Pedro Beta", document_type="CC", document="789012", phone="3009998877", email="pedro@beta.com", is_active=True)
    db.add_all([client1, client2, client_beta])
    db.commit()

    # Membership Plan & Membership
    plan1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual", duration_days=30, price=Decimal("120000.00"), is_active=True)
    db.add(plan1)
    db.commit()

    # Notification Templates
    template1 = NotificationTemplate(
        id=1,
        gym_id=1,
        event_type=NotificationEventType.MEMBERSHIP_SOLD,
        channel=NotificationChannel.WHATSAPP,
        template_body="Hola {client_name}, tu {membership_name} en {gym_name} ha sido activada. Monto: {amount}.",
        is_active=True
    )
    template2 = NotificationTemplate(
        id=2,
        gym_id=1,
        event_type=NotificationEventType.PAYMENT_RECEIVED,
        channel=NotificationChannel.WHATSAPP,
        template_body="Hola {client_name}, recibimos tu pago de {amount} via {payment_method}.",
        is_active=True
    )
    db.add_all([template1, template2])
    db.commit()

    # Gym 1 WhatsApp Integration (Gym 2 remains unconfigured)
    integ1 = WhatsAppIntegration(
        id=1,
        gym_id=1,
        phone_number_id="100200300",
        access_token_encrypted=encrypt_token("valid_token"),
        waba_id="waba_alpha_1",
        display_phone_number="+573001234567",
        status="CONNECTED",
        is_active=True,
    )
    db.add(integ1)
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_phone_normalization_and_validation():
    assert normalize_phone_co("3001234567") == "573001234567"
    assert normalize_phone_co("+57 300 123 4567") == "573001234567"
    assert normalize_phone_co("573001234567") == "573001234567"
    assert is_valid_phone("3001234567") is True
    assert is_valid_phone("+573001234567") is True
    assert is_valid_phone("abc1234") is False
    assert is_valid_phone("") is False


def test_02_whatsapp_sender_configured_check():
    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "12345", "WHATSAPP_ACCESS_TOKEN": "secret_tok"}):
        assert WhatsAppSender.is_configured() is True

    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "", "WHATSAPP_ACCESS_TOKEN": ""}):
        assert WhatsAppSender.is_configured() is False


def test_03_whatsapp_status_endpoint():
    global current_test_user
    db = TestingSessionLocal()
    # Gym 1 has active integration -> configured is True
    current_test_user = db.query(User).filter(User.id == 1).first()
    resp = client.get("/notifications/whatsapp-status")
    assert resp.status_code == 200
    assert resp.json()["configured"] is True

    # Gym 2 has no integration -> configured is False
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp = client.get("/notifications/whatsapp-status")
    assert resp.status_code == 200
    assert resp.json()["configured"] is False


def test_04_send_notification_to_valid_client_with_mocked_meta_api():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    mock_response = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "573001234567", "wa_id": "573001234567"}],
        "messages": [{"id": "wamid.HBgM..."}]
    }

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_cm = MagicMock()
        mock_cm.read.return_value = json.dumps(mock_response).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_cm

        payload = {
            "client_id": 1,
            "event_type": "GENERAL",
            "channel": "WHATSAPP",
            "recipient": "3001234567",
            "message_body": "Hola Carlos, bienvenido a ZonaFit."
        }

        resp = client.post("/notifications/send", json=payload)
        assert resp.status_code == 202
        data = resp.json()
        assert data["status"] == "PENDING"
        assert data["recipient"] == "573001234567"
        assert data["client_id"] == 1

        # Execute background task synchronously with test db
        NotificationService.send_and_update(data["id"], db=db)

        db.expire_all()
        notif = db.query(Notification).filter(Notification.id == data["id"]).first()
        assert notif.status == NotificationStatus.SENT
        assert notif.sent_at is not None


def test_05_meta_api_payload_structure_verified():
    captured_request = {}

    def mock_urlopen_fn(req, *args, **kwargs):
        captured_request["url"] = req.full_url
        captured_request["headers"] = req.headers
        captured_request["body"] = json.loads(req.data.decode("utf-8"))
        mock_cm = MagicMock()
        mock_cm.read.return_value = json.dumps({"messages": [{"id": "wamid.123"}]}).encode("utf-8")
        mock_cm.__enter__.return_value = mock_cm
        return mock_cm

    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "987654321", "WHATSAPP_ACCESS_TOKEN": "meta_access_token_xyz"}):
        with patch("urllib.request.urlopen", side_effect=mock_urlopen_fn):
            result = WhatsAppSender.send_text("573001234567", "Prueba de estructura")
            assert "messages" in result
            assert captured_request["url"] == "https://graph.facebook.com/v22.0/987654321/messages"
            assert captured_request["headers"]["Authorization"] == "Bearer meta_access_token_xyz"
            assert captured_request["headers"]["Content-type"] == "application/json"
            assert captured_request["body"]["messaging_product"] == "whatsapp"
            assert captured_request["body"]["to"] == "573001234567"
            assert captured_request["body"]["text"]["body"] == "Prueba de estructura"


def test_06_send_notification_invalid_phone_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "client_id": 1,
        "event_type": "GENERAL",
        "channel": "WHATSAPP",
        "recipient": "numero_invalido",
        "message_body": "Mensaje de prueba"
    }
    resp = client.post("/notifications/send", json=payload)
    assert resp.status_code == 400
    assert "no tiene un formato válido" in resp.json()["detail"]


def test_07_dispatch_from_template_with_empty_phone_returns_none():
    db = TestingSessionLocal()
    # Client 2 has empty phone
    notif = NotificationService.dispatch_from_template(
        db=db,
        gym_id=1,
        event_type=NotificationEventType.MEMBERSHIP_SOLD,
        channel=NotificationChannel.WHATSAPP,
        recipient="",
        context={"client_name": "Ana", "membership_name": "Plan Mensual", "gym_name": "ZonaFit", "amount": "$120.000"},
        client_id=2
    )
    assert notif is None


def test_08_meta_api_error_updates_notification_status_to_failed():
    import urllib.error

    db = TestingSessionLocal()
    notif = NotificationService.dispatch(
        db=db,
        gym_id=1,
        client_id=1,
        event_type="GENERAL",
        channel="WHATSAPP",
        recipient="573001234567",
        message_body="Mensaje que fallara"
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_error = urllib.error.HTTPError(
            url="https://graph.facebook.com/v22.0/100200300/messages",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=MagicMock(read=lambda *a, **k: b'{"error": {"message": "(#131030) Recipient phone number not in allowed list"}}')
        )
        mock_urlopen.side_effect = mock_error

        NotificationService.send_and_update(notif.id, db=db)

        db.expire_all()
        failed_notif = db.query(Notification).filter(Notification.id == notif.id).first()
        assert failed_notif.status == NotificationStatus.FAILED
        assert "131030" in failed_notif.error_detail


def test_09_unconfigured_credentials_marks_notification_failed():
    db = TestingSessionLocal()
    integ = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
    integ.is_active = False
    db.commit()

    try:
        notif = NotificationService.dispatch(
            db=db,
            gym_id=1,
            client_id=1,
            event_type="GENERAL",
            channel="WHATSAPP",
            recipient="573001234567",
            message_body="Mensaje sin credenciales"
        )

        NotificationService.send_and_update(notif.id, db=db)

        db.expire_all()
        failed_notif = db.query(Notification).filter(Notification.id == notif.id).first()
        assert failed_notif.status == NotificationStatus.FAILED
        assert "not configured for gym 1" in failed_notif.error_detail
    finally:
        integ.is_active = True
        db.commit()


def test_10_multi_tenant_isolation_cannot_send_to_foreign_client_or_view_foreign_notifications():
    global current_test_user
    db = TestingSessionLocal()

    # User 2 (Gym 2) attempts to send notification referencing Client 1 (Gym 1)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    resp_send = client.post("/notifications/send", json={
        "client_id": 1,
        "event_type": "GENERAL",
        "channel": "WHATSAPP",
        "recipient": "3001234567",
        "message_body": "Intento de enviar a cliente ajeno"
    })
    assert resp_send.status_code == 404
    assert "Cliente no encontrado" in resp_send.json()["detail"]

    # User 2 cannot view notification 1 of Gym 1
    resp_get = client.get("/notifications/1")
    assert resp_get.status_code == 404

    # User 2 listing notifications only sees Gym 2
    resp_list = client.get("/notifications/")
    assert resp_list.status_code == 200
    assert resp_list.json()["total"] == 0


def test_11_unauthorized_role_rejected():
    global current_test_user
    db = TestingSessionLocal()

    # Staff user (not Admin)
    current_test_user = db.query(User).filter(User.id == 3).first()
    assert current_test_user.role == "STAFF"

    resp = client.post("/notifications/send", json={
        "client_id": 1,
        "event_type": "GENERAL",
        "channel": "WHATSAPP",
        "recipient": "3001234567",
        "message_body": "Staff intentando enviar"
    })
    assert resp.status_code == 403


def test_12_send_whatsapp_does_not_modify_financial_or_inventory_state():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Capture initial counts
    payments_count_before = db.query(Payment).count()
    cash_mov_before = db.query(CashMovement).count()
    sales_count_before = db.query(Sale).count()
    memberships_count_before = db.query(Membership).count()

    # Send multiple WhatsApp notifications
    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "123", "WHATSAPP_ACCESS_TOKEN": "abc"}):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_cm = MagicMock()
            mock_cm.read.return_value = json.dumps({"messages": [{"id": "wamid.1"}]}).encode("utf-8")
            mock_urlopen.return_value.__enter__.return_value = mock_cm

            client.post("/notifications/send", json={
                "client_id": 1,
                "event_type": "GENERAL",
                "channel": "WHATSAPP",
                "recipient": "3001234567",
                "message_body": "Mensaje 1"
            })
            client.post("/notifications/send", json={
                "client_id": 1,
                "event_type": "GENERAL",
                "channel": "WHATSAPP",
                "recipient": "3001234567",
                "message_body": "Mensaje 2 (Reintento)"
            })

    # Verify financial and inventory state remains completely unaltered
    db.expire_all()
    assert db.query(Payment).count() == payments_count_before
    assert db.query(CashMovement).count() == cash_mov_before
    assert db.query(Sale).count() == sales_count_before
    assert db.query(Membership).count() == memberships_count_before


def test_13_template_rendering_with_context_variables():
    db = TestingSessionLocal()
    notif = NotificationService.dispatch_from_template(
        db=db,
        gym_id=1,
        event_type=NotificationEventType.PAYMENT_RECEIVED,
        channel=NotificationChannel.WHATSAPP,
        recipient="3001234567",
        context={
            "client_name": "Carlos Gomez",
            "amount": "$120.000",
            "payment_method": "TRANSFER"
        },
        client_id=1
    )
    assert notif is not None
    assert notif.recipient == "573001234567"
    assert "Carlos Gomez" in notif.message_body
    assert "$120.000" in notif.message_body
    assert "TRANSFER" in notif.message_body
