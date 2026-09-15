import os
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import get_db
from app.core.auth import get_current_user
from app.main import app
from app.models.gym import Gym
from app.models.user import User
from app.models.client import Client
from app.models.subscription import Subscription
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.models.audit_log import AuditLog
from app.models.gym_settings import GymSettings

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def set_sqlite_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

client = TestClient(app)
current_test_user = None


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    return current_test_user


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    global current_test_user
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 (Main test gym)
    gym1 = Gym(id=1, name="Merwil Gym Alpha", email="alpha@gym.com", is_active=True)
    gym2 = Gym(id=2, name="Foreign Gym Beta", email="beta@gym.com", is_active=True)
    db.add_all([gym1, gym2])
    db.commit()

    # Active SaaS Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(
        id=1,
        gym_id=1,
        status="ACTIVE",
        starts_at=now - timedelta(days=1),
        ends_at=now + timedelta(days=30),
        is_lifetime=True
    )
    sub2 = Subscription(
        id=2,
        gym_id=2,
        status="ACTIVE",
        starts_at=now - timedelta(days=1),
        ends_at=now + timedelta(days=30),
        is_lifetime=True
    )
    db.add_all([sub1, sub2])

    # GymSettings for Gym 1
    gs1 = GymSettings(
        id=1,
        gym_id=1,
        legal_name="Merwil ZonaFit SAS",
        trade_name="Merwil ZonaFit",
        tax_id="901234567-1",
        official_phone="3001234567",
        official_email="contacto@zonafit.com",
        physical_address="Calle 100 #10-20",
        city="Bogota",
    )
    db.add(gs1)

    # Users
    u1 = User(id=1, gym_id=1, full_name="Admin Alpha", email="admin@alpha.com", password="hash", role="ADMIN", is_active=True)
    u2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin@beta.com", password="hash", role="ADMIN", is_active=True)
    db.add_all([u1, u2])

    # Clients
    c1 = Client(id=1, gym_id=1, full_name="Juan Perez", document_type="CC", document="10101", phone="3001234567", email="juan@alpha.com", is_active=True)
    c2 = Client(id=2, gym_id=1, full_name="Maria Sin Telefono", document_type="CC", document="10102", phone="", email="maria@alpha.com", is_active=True)
    c_foreign = Client(id=3, gym_id=2, full_name="Carlos Beta", document_type="CC", document="20201", phone="3109876543", email="carlos@beta.com", is_active=True)
    db.add_all([c1, c2, c_foreign])

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    current_test_user = u1

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_prepare_message_with_default_template():
    payload = {
        "client_id": 1,
        "event_type": "MEMBERSHIP_EXPIRY",
        "context_data": {
            "expiry_date": "2026-09-30",
        },
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["client_name"] == "Juan Perez"
    assert data["phone"] == "573001234567"
    assert "Merwil ZonaFit" in data["rendered_message"]
    assert "2026-09-30" in data["rendered_message"]
    assert data["channel"] == "WHATSAPP_WEB"


def test_02_prepare_message_uses_custom_template():
    db = TestingSessionLocal()
    custom_tmpl = NotificationTemplate(
        gym_id=1,
        event_type="WELCOME",
        channel="WHATSAPP_WEB",
        template_body="¡Hola {client_name}! Bienvenido a la familia {gym_name}. Tu plan ya está listo.",
        is_active=True,
    )
    db.add(custom_tmpl)
    db.commit()

    payload = {
        "client_id": 1,
        "event_type": "WELCOME",
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["rendered_message"] == "¡Hola Juan Perez! Bienvenido a la familia Merwil ZonaFit. Tu plan ya está listo."


def test_03_prepare_message_contextual_cartera():
    payload = {
        "client_id": 1,
        "event_type": "CREDIT_OVERDUE",
        "context_data": {
            "amount": "$45.000 COP",
            "due_date": "15 de Sep",
        },
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "$45.000 COP" in data["rendered_message"]


def test_04_prepare_message_contextual_sale():
    payload = {
        "client_id": 1,
        "event_type": "PAYMENT_RECEIVED",
        "context_data": {
            "amount": "$85.000 COP",
            "detail": "1x Proteína Whey, 1x Bebida Energética",
        },
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "$85.000 COP" in data["rendered_message"]
    assert "Proteína Whey" in data["rendered_message"]


def test_05_prepare_message_client_without_phone():
    payload = {
        "client_id": 2,  # Maria Sin Telefono
        "event_type": "MEMBERSHIP_EXPIRY",
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["phone"] == ""
    assert data["raw_phone"] == ""
    assert data["client_name"] == "Maria Sin Telefono"


def test_06_prepare_message_multi_tenant_foreign_client_rejected():
    payload = {
        "client_id": 3,  # Belongs to Gym 2
        "event_type": "GENERAL",
    }
    resp = client.post("/communications/prepare", json=payload)
    assert resp.status_code == 404
    assert "Cliente no encontrado" in resp.json()["detail"]


def test_07_record_opened_creates_notification_history():
    payload = {
        "client_id": 1,
        "event_type": "MEMBERSHIP_EXPIRY",
        "recipient": "3001234567",
        "message_body": "Hola Juan, te recordamos tu vencimiento.",
    }
    resp = client.post("/communications/record-opened", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["notification_id"] > 0

    # Verify DB record
    db = TestingSessionLocal()
    notif = db.query(Notification).filter(Notification.id == data["notification_id"]).first()
    assert notif is not None
    assert notif.channel == "WHATSAPP_WEB"
    assert notif.status == "OPENED"
    assert notif.delivery_status == "OPENED"
    assert notif.status != "SENT"
    assert notif.recipient == "573001234567"
    assert notif.gym_id == 1

    # Verify AuditLog record
    audit = db.query(AuditLog).filter(
        AuditLog.gym_id == 1,
        AuditLog.action == "WHATSAPP_WEB_OPENED",
        AuditLog.entity_id == 1,
    ).first()
    assert audit is not None


def test_08_record_opened_multi_tenant_foreign_client_rejected():
    payload = {
        "client_id": 3,  # Gym 2 client
        "event_type": "GENERAL",
        "recipient": "3109876543",
        "message_body": "Hola Carlos",
    }
    resp = client.post("/communications/record-opened", json=payload)
    assert resp.status_code == 404
