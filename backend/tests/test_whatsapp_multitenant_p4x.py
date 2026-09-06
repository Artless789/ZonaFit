import os
import json
import hmac
import hashlib
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.config import settings
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.notification import Notification
from app.models.whatsapp_integration import WhatsAppIntegration
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from app.core.encryption import encrypt_token, decrypt_token
from app.services.whatsapp_sender import WhatsAppSender
from app.services.notification_service import NotificationService
from app.constants.notification_statuses import NotificationStatus as NStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_whatsapp_multitenant.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

from sqlalchemy import event
from sqlalchemy.engine import Engine

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

@pytest.fixture(autouse=True)
def apply_overrides():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Alpha Fitness", email="alpha@fit.com", owner_id=1)
    gym2 = Gym(id=2, name="Beta Crossfit", email="beta@cross.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Alpha Owner", email="owner@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Beta Owner", email="owner@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Clients
    c1 = Client(id=1, gym_id=1, full_name="Juan Perez", document_type="CC", document="111", phone="3001112233", email="juan@alpha.com", is_active=True)
    c2 = Client(id=2, gym_id=2, full_name="Maria Gomez", document_type="CC", document="222", phone="3004445566", email="maria@beta.com", is_active=True)
    db.add_all([c1, c2])
    db.commit()

    yield
    db.close()

def test_01_token_encryption_and_decryption():
    raw_token = "EAABwz_secret_meta_token_123456789"
    enc = encrypt_token(raw_token)
    assert enc != raw_token
    dec = decrypt_token(enc)
    assert dec == raw_token

def test_02_connect_whatsapp_integration_encrypts_token_and_does_not_leak():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "phone_number_id": "100998877665544",
        "access_token": "SUPER_SECRET_TOKEN_ALPHA",
        "waba_id": "waba_alpha_123",
        "display_phone_number": "+57 300 111 2233",
        "verified_name": "Alpha Fitness Oficial"
    }
    response = client.post("/whatsapp/integration/connect", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["phone_number_id"] == "100998877665544"
    assert data["status"] == "CONNECTED"
    assert "access_token" not in data
    assert "access_token_encrypted" not in data

    # Verify in DB that it is encrypted
    db_integ = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
    assert db_integ is not None
    assert db_integ.access_token_encrypted != "SUPER_SECRET_TOKEN_ALPHA"
    assert decrypt_token(db_integ.access_token_encrypted) == "SUPER_SECRET_TOKEN_ALPHA"
    db.close()

def test_03_multi_tenant_isolation_between_gyms():
    global current_test_user
    db = TestingSessionLocal()
    # Gym 2 user querying integration
    current_test_user = db.query(User).filter(User.id == 2).first()

    # Gym 2 should not have gym 1's integration
    response = client.get("/whatsapp/integration")
    assert response.status_code == 404

    # Connect Gym 2 with distinct credentials
    payload = {
        "phone_number_id": "200998877665544",
        "access_token": "SUPER_SECRET_TOKEN_BETA",
        "waba_id": "waba_beta_456"
    }
    resp2 = client.post("/whatsapp/integration/connect", json=payload)
    assert resp2.status_code == 200
    assert resp2.json()["phone_number_id"] == "200998877665544"

    # Confirm Gym 1 and Gym 2 have separate integrations
    integ1 = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
    integ2 = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 2).first()
    assert integ1.phone_number_id != integ2.phone_number_id
    assert decrypt_token(integ1.access_token_encrypted) == "SUPER_SECRET_TOKEN_ALPHA"
    assert decrypt_token(integ2.access_token_encrypted) == "SUPER_SECRET_TOKEN_BETA"
    db.close()

def test_04_send_notification_routes_to_gym_credentials():
    db = TestingSessionLocal()
    notif = NotificationService.dispatch(
        db=db,
        gym_id=1,
        client_id=1,
        event_type="PAYMENT_RECEIVED",
        channel="WHATSAPP",
        recipient="573001112233",
        message_body="Recibo de pago Alpha"
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"messaging_product": "whatsapp", "messages": [{"id": "wamid.HBgLMTEx"}]}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        NotificationService.send_and_update(notification_id=notif.id, db=db)

        # Verify urllib request used Gym 1's token and phone_number_id
        called_req = mock_urlopen.call_args[0][0]
        assert "100998877665544" in called_req.full_url
        assert called_req.headers["Authorization"] == "Bearer SUPER_SECRET_TOKEN_ALPHA"

    db.refresh(notif)
    assert notif.status == NStatus.SENT
    assert notif.provider_message_id == "wamid.HBgLMTEx"
    assert notif.delivery_status == "SENT"
    db.close()

def test_04_b_send_notification_routes_to_gym_b_credentials():
    db = TestingSessionLocal()
    notif = NotificationService.dispatch(
        db=db,
        gym_id=2,
        client_id=2,
        event_type="PAYMENT_RECEIVED",
        channel="WHATSAPP",
        recipient="573004445566",
        message_body="Recibo de pago Beta"
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"messaging_product": "whatsapp", "messages": [{"id": "wamid.HBgLMjIy"}]}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        NotificationService.send_and_update(notification_id=notif.id, db=db)

        # Verify urllib request strictly used Gym 2's token and phone_number_id (never Gym 1's or global)
        called_req = mock_urlopen.call_args[0][0]
        assert "200998877665544" in called_req.full_url
        assert called_req.headers["Authorization"] == "Bearer SUPER_SECRET_TOKEN_BETA"

    db.refresh(notif)
    assert notif.status == NStatus.SENT
    assert notif.provider_message_id == "wamid.HBgLMjIy"
    assert notif.delivery_status == "SENT"
    db.close()

def test_04_c_platform_system_user_token_does_not_substitute_unconfigured_gym():
    db = TestingSessionLocal()

    # Gym 3 exists but has NO WhatsAppIntegration
    gym3 = db.query(Gym).filter(Gym.id == 3).first()
    if not gym3:
        gym3 = Gym(id=3, name="Gamma Gym Unconfigured", email="gamma@fit.com", owner_id=1)
        db.add(gym3)
        db.commit()

    # Even when META_SYSTEM_USER_TOKEN and global env credentials exist on the platform:
    with patch.object(settings, "META_SYSTEM_USER_TOKEN", "PLATFORM_GLOBAL_SYSTEM_USER_TOKEN"):
        with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "GLOBAL_PHONE", "WHATSAPP_ACCESS_TOKEN": "GLOBAL_TOKEN"}):
            # 1. is_configured MUST return False for gym 3
            assert WhatsAppSender.is_configured(db=db, gym_id=3) is False

            # 2. get_credentials MUST raise ValueError and not substitute platform or env credentials
            with pytest.raises(ValueError) as exc_info:
                WhatsAppSender.get_credentials(db=db, gym_id=3)
            assert "WhatsApp credentials are not configured for gym 3" in str(exc_info.value)

            # 3. NotificationService.send_and_update MUST fail without calling urllib
            notif = NotificationService.dispatch(
                db=db,
                gym_id=3,
                client_id=None,
                event_type="GENERAL",
                channel="WHATSAPP",
                recipient="573007778899",
                message_body="Intento de envio sin integracion"
            )

            with patch("urllib.request.urlopen") as mock_urlopen:
                NotificationService.send_and_update(notification_id=notif.id, db=db)
                mock_urlopen.assert_not_called()

            db.refresh(notif)
            assert notif.status == NStatus.FAILED
            assert "not configured for gym 3" in notif.error_detail

    db.close()

def test_05_whatsapp_webhook_verification():
    # Valid subscribe
    resp = client.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "challenge_code_12345",
            "hub.verify_token": "zonafit_webhook_verify_token"
        }
    )
    assert resp.status_code == 200
    assert resp.text == "challenge_code_12345"

    # Invalid token rejected
    resp_bad = client.get(
        "/webhooks/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.challenge": "challenge_code_12345",
            "hub.verify_token": "wrong_token"
        }
    )
    assert resp_bad.status_code == 403

def test_06_whatsapp_webhook_event_updates_delivery_status():
    db = TestingSessionLocal()
    notif = db.query(Notification).filter(Notification.provider_message_id == "wamid.HBgLMTEx").first()
    assert notif is not None

    webhook_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "waba_alpha_123",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "messaging_product": "whatsapp",
                            "statuses": [
                                {
                                    "id": "wamid.HBgLMTEx",
                                    "status": "delivered",
                                    "timestamp": "1710000000",
                                    "recipient_id": "573001112233"
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    secret = "multitenant_test_secret"
    raw = json.dumps(webhook_payload).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    with patch.object(settings, "META_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/webhooks/whatsapp",
            content=raw,
            headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}

    db.refresh(notif)
    assert notif.delivery_status == "DELIVERED"
    assert notif.status == NStatus.SENT
    db.close()

def test_07_failed_delivery_updates_notification_without_raising():
    db = TestingSessionLocal()
    notif = db.query(Notification).filter(Notification.provider_message_id == "wamid.HBgLMTEx").first()

    webhook_failed = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": "wamid.HBgLMTEx",
                                    "status": "failed",
                                    "errors": [{"code": 131026, "message": "Message undeliverable"}]
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    secret = "multitenant_test_secret"
    raw = json.dumps(webhook_failed).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    with patch.object(settings, "META_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/webhooks/whatsapp",
            content=raw,
            headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
        )
    assert resp.status_code == 200

    db.refresh(notif)
    assert notif.delivery_status == "FAILED"
    assert notif.status == NStatus.FAILED
    assert notif.error_code == "131026"
    assert "Message undeliverable" in notif.error_detail
    db.close()
