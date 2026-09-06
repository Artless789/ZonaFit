import os
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database.database import get_db
from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.gym import Gym
from app.models.whatsapp_integration import WhatsAppIntegration
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from app.core.encryption import encrypt_token, decrypt_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_whatsapp_embedded.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
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
            if hasattr(statement, "text") and "set_config" in statement.text.lower():
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
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    from app.database.base import Base

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Olimpo", email="olimpo@fit.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Sparta", email="sparta@fit.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin Olimpo", email="admin@olimpo.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Sparta", email="admin@sparta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    yield
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_01_get_meta_config_endpoint():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    with patch.object(settings, "META_APP_ID", "123456789"), patch.object(settings, "META_CONFIG_ID", "cfg_987654"):
        resp = client.get("/whatsapp/integrations/meta-config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["app_id"] == "123456789"
        assert data["config_id"] == "cfg_987654"
        assert data["api_version"] == "v22.0"
        assert data["is_configured"] is True

        # Test backwards compatibility alias
        resp_alias = client.get("/whatsapp/integration/meta-config")
        assert resp_alias.status_code == 200
        assert resp_alias.json() == data
    db.close()


def test_02_embedded_signup_success_with_long_lived_token_exchange():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    mock_short_lived_response = {
        "access_token": "EAAG_SHORT_LIVED_TOKEN",
        "token_type": "bearer",
    }
    mock_long_lived_response = {
        "access_token": "EAAG_LONG_LIVED_TOKEN_60_DAYS",
        "token_type": "bearer",
    }
    mock_phone_details = {
        "id": "phone_id_999",
        "display_phone_number": "+57 300 999 8877",
        "verified_name": "Gimnasio Olimpo Oficial",
        "quality_rating": "GREEN",
    }

    exchanged_long_lived = False
    subscribed_waba = False

    subscribed_auth_header = None
    phone_auth_header = None

    def mock_urlopen(req, *args, **kwargs):
        nonlocal exchanged_long_lived, subscribed_waba, subscribed_auth_header, phone_auth_header
        url = req.full_url
        mock_cm = MagicMock()
        if "grant_type=fb_exchange_token" in url:
            exchanged_long_lived = True
            mock_cm.read.return_value = json.dumps(mock_long_lived_response).encode("utf-8")
        elif "oauth/access_token" in url:
            mock_cm.read.return_value = json.dumps(mock_short_lived_response).encode("utf-8")
        elif "subscribed_apps" in url:
            subscribed_waba = True
            subscribed_auth_header = req.headers.get("Authorization")
            mock_cm.read.return_value = b'{"success": true}'
        elif "phone_id_999" in url:
            phone_auth_header = req.headers.get("Authorization")
            mock_cm.read.return_value = json.dumps(mock_phone_details).encode("utf-8")
        else:
            mock_cm.read.return_value = b"{}"
        mock_cm.__enter__.return_value = mock_cm
        return mock_cm

    with (
        patch.object(settings, "META_APP_ID", "app_123"),
        patch.object(settings, "META_APP_SECRET", "sec_456"),
        patch.object(settings, "META_SYSTEM_USER_TOKEN", "PLATFORM_ADMIN_SYSTEM_USER_TOKEN"),
    ):
        with patch("urllib.request.urlopen", side_effect=mock_urlopen):
            payload = {
                "code": "AQB_valid_oauth_code_from_facebook_sdk",
                "waba_id": "waba_olimpo_001",
                "phone_number_id": "phone_id_999",
                "business_id": "biz_olimpo_001",
            }
            resp = client.post("/whatsapp/integrations/embedded-signup", json=payload)
            assert resp.status_code == 200
            data = resp.json()
            assert data["phone_number_id"] == "phone_id_999"
            assert data["display_phone_number"] == "+57 300 999 8877"
            assert data["verified_name"] == "Gimnasio Olimpo Oficial"
            assert data["status"] == "CONNECTED"
            assert data["quality_rating"] == "GREEN"
            assert "access_token" not in data
            assert "access_token_encrypted" not in data

            # Confirm long-lived token exchange and webhook subscription occurred
            assert exchanged_long_lived is True
            assert subscribed_waba is True

            # Platform admin token was used for administrative webhook subscription
            assert subscribed_auth_header == "Bearer PLATFORM_ADMIN_SYSTEM_USER_TOKEN"

            # Gym's own access token was used for phone queries
            assert phone_auth_header == "Bearer EAAG_LONG_LIVED_TOKEN_60_DAYS"

            # CRITICAL: Verify in DB that the gym's OWN long-lived token is encrypted and stored,
            # NOT the platform's META_SYSTEM_USER_TOKEN!
            integ = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
            assert integ is not None
            assert integ.access_token_encrypted != "EAAG_LONG_LIVED_TOKEN_60_DAYS"
            assert integ.access_token_encrypted != "PLATFORM_ADMIN_SYSTEM_USER_TOKEN"
            assert decrypt_token(integ.access_token_encrypted) == "EAAG_LONG_LIVED_TOKEN_60_DAYS"
            assert decrypt_token(integ.access_token_encrypted) != "PLATFORM_ADMIN_SYSTEM_USER_TOKEN"
    db.close()


def test_03_get_active_integration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/whatsapp/integrations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone_number_id"] == "phone_id_999"
    assert data["status"] == "CONNECTED"
    assert "access_token" not in data
    db.close()


def test_04_embedded_signup_missing_server_credentials():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 2).first()

    with patch.object(settings, "META_APP_ID", ""), patch.object(settings, "META_APP_SECRET", ""):
        payload = {"code": "AQB_any_code"}
        resp = client.post("/whatsapp/integrations/embedded-signup", json=payload)
        assert resp.status_code == 400
        assert "META_APP_ID" in resp.json()["detail"]
    db.close()


def test_05_embedded_signup_meta_oauth_error():
    import urllib.error
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 2).first()

    with patch.object(settings, "META_APP_ID", "app_123"), patch.object(settings, "META_APP_SECRET", "sec_456"):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_error = urllib.error.HTTPError(
                url="https://graph.facebook.com/v22.0/oauth/access_token",
                code=400,
                msg="Bad Request",
                hdrs={},
                fp=MagicMock(read=lambda *a, **k: b'{"error": {"message": "Invalid verification code format."}}')
            )
            mock_urlopen.side_effect = mock_error

            payload = {"code": "bad_code", "phone_number_id": "123"}
            resp = client.post("/whatsapp/integrations/embedded-signup", json=payload)
            assert resp.status_code == 400
            assert "Invalid verification code format" in resp.json()["detail"]
    db.close()


def test_06_send_test_message():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({"messages": [{"id": "wamid.test_123"}]}).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        payload = {
            "to_phone": "3001234567",
            "message": "Hola desde prueba de integración ZonaFit",
        }
        resp = client.post("/whatsapp/integrations/test", json=payload)
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"
    db.close()


def test_07_disconnect_integration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.post("/whatsapp/integrations/disconnect")
    assert resp.status_code == 200
    assert "desconectada exitosamente" in resp.json()["message"]

    # Verify GET now returns 404
    resp_get = client.get("/whatsapp/integrations")
    assert resp_get.status_code == 404

    integ = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
    assert integ.is_active is False
    assert integ.status == "DISCONNECTED"
    db.close()


def test_08_webhook_phone_quality_update_with_valid_signature():
    import hmac
    import hashlib

    db = TestingSessionLocal()
    # Re-activate integration with UNKNOWN quality
    integ = db.query(WhatsAppIntegration).filter(WhatsAppIntegration.gym_id == 1).first()
    integ.is_active = True
    integ.quality_rating = "UNKNOWN"
    db.commit()

    webhook_payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "waba_olimpo_001",
                "changes": [
                    {
                        "field": "phone_number_quality_update",
                        "value": {
                            "display_phone_number": "+57 300 999 8877",
                            "event": "UPGRADE",
                            "quality_rating": "GREEN",
                        }
                    }
                ]
            }
        ]
    }

    secret = "meta_test_secret_123"
    raw = json.dumps(webhook_payload).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    with patch.object(settings, "META_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/webhooks/whatsapp",
            content=raw,
            headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
        )
    assert resp.status_code == 200

    db.refresh(integ)
    assert integ.quality_rating == "GREEN"
    db.close()


def test_09_webhook_fail_closed_valid_signature_accepted():
    import hmac
    import hashlib

    payload = {"object": "whatsapp_business_account", "entry": []}
    secret = "strict_webhook_secret_xyz"
    raw = json.dumps(payload).encode("utf-8")
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    with patch.object(settings, "META_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/webhooks/whatsapp",
            content=raw,
            headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_10_webhook_fail_closed_invalid_signature_rejected():
    payload = {"object": "whatsapp_business_account", "entry": []}
    secret = "strict_webhook_secret_xyz"
    raw = json.dumps(payload).encode("utf-8")

    with patch.object(settings, "META_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/webhooks/whatsapp",
            content=raw,
            headers={"X-Hub-Signature-256": "sha256=invalid_forged_signature_999", "Content-Type": "application/json"},
        )
    assert resp.status_code == 401
    assert "Invalid or missing webhook signature" in resp.json()["detail"]


def test_11_webhook_fail_closed_missing_secret_rejected():
    payload = {"object": "whatsapp_business_account", "entry": []}
    raw = json.dumps(payload).encode("utf-8")

    # When both secrets are empty/None on server, fail-closed MUST reject
    with patch.object(settings, "META_WEBHOOK_SECRET", ""), patch.object(settings, "META_APP_SECRET", ""):
        with patch.dict(os.environ, {"WHATSAPP_APP_SECRET": ""}):
            resp = client.post(
                "/webhooks/whatsapp",
                content=raw,
                headers={"X-Hub-Signature-256": "sha256=any_hash", "Content-Type": "application/json"},
            )
    assert resp.status_code == 401
    assert "Invalid or missing webhook signature" in resp.json()["detail"]
