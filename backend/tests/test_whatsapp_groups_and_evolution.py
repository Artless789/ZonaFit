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
from app.models.whatsapp_group import WhatsAppGroup
from app.models.notification_template import NotificationTemplate
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.accounts_receivable import AccountsReceivable
from app.models.sale import Sale
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

    # Gym 1 (Alpha) & Gym 2 (Beta)
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

    # GymSettings
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

    # Plan for memberships
    plan = MembershipPlan(
        id=1,
        gym_id=1,
        name="Plan Mensual",
        price=Decimal("65000"),
        duration_days=30,
        is_active=True
    )
    db.add(plan)
    db.commit()

    # WhatsApp Group for Gym 2 (foreign)
    g_foreign = WhatsAppGroup(
        id=99,
        gym_id=2,
        name="Grupo Beta Privado",
        invite_url="https://chat.whatsapp.com/ForeignInvite123",
        is_active=True
    )
    db.add(g_foreign)
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    current_test_user = u1

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# ── GRUPOS TESTS ─────────────────────────────────────────────────────────────

def test_01_create_whatsapp_group_success():
    payload = {
        "name": "Clientes Mañana",
        "description": "Comunidad de entrenamiento matutino",
        "invite_url": "https://chat.whatsapp.com/AbCdEf123456",
        "is_active": True
    }
    response = client.post("/whatsapp-groups/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Clientes Mañana"
    assert data["invite_url"] == "https://chat.whatsapp.com/AbCdEf123456"
    assert data["gym_id"] == 1


def test_02_create_whatsapp_group_invalid_urls():
    # Non-HTTPS
    res1 = client.post("/whatsapp-groups/", json={
        "name": "Inseguro",
        "invite_url": "http://chat.whatsapp.com/test",
    })
    assert res1.status_code == 422

    # Malicious script
    res2 = client.post("/whatsapp-groups/", json={
        "name": "XSS Script",
        "invite_url": "javascript:alert(1)",
    })
    assert res2.status_code == 422

    # Non-WhatsApp domain
    res3 = client.post("/whatsapp-groups/", json={
        "name": "Phishing",
        "invite_url": "https://evil-phishing.com/group",
    })
    assert res3.status_code == 422


def test_03_list_whatsapp_groups_tenant_isolation():
    global current_test_user
    # As User 1 (Gym 1), list groups
    res1 = client.get("/whatsapp-groups/")
    assert res1.status_code == 200
    groups1 = res1.json()
    assert len(groups1) >= 1
    assert all(g["gym_id"] == 1 for g in groups1)
    assert not any(g["id"] == 99 for g in groups1)  # Gym 2's group not visible

    # Switch to User 2 (Gym 2)
    db = TestingSessionLocal()
    u2 = db.query(User).filter(User.id == 2).first()
    current_test_user = u2
    res2 = client.get("/whatsapp-groups/")
    assert res2.status_code == 200
    groups2 = res2.json()
    assert len(groups2) == 1
    assert groups2[0]["id"] == 99

    # Switch back to User 1
    u1 = db.query(User).filter(User.id == 1).first()
    current_test_user = u1
    db.close()


def test_04_update_whatsapp_group():
    # Get group from Gym 1
    groups = client.get("/whatsapp-groups/").json()
    group_id = groups[0]["id"]

    update_payload = {
        "description": "Nueva descripción actualizada",
        "invite_url": "https://chat.whatsapp.com/UpdatedLink999"
    }
    res = client.put(f"/whatsapp-groups/{group_id}", json=update_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["description"] == "Nueva descripción actualizada"
    assert data["invite_url"] == "https://chat.whatsapp.com/UpdatedLink999"


def test_05_multi_tenant_update_and_delete_protection():
    global current_test_user
    # Gym 1 user tries to update Gym 2 group (id=99)
    res_update = client.put("/whatsapp-groups/99", json={"name": "Hacked"})
    assert res_update.status_code == 404

    # Gym 1 user tries to delete Gym 2 group (id=99)
    res_delete = client.delete("/whatsapp-groups/99")
    assert res_delete.status_code == 404


# ── CLIENT TESTS ─────────────────────────────────────────────────────────────

def test_06_create_client_with_default_no_group_and_no_opt_in():
    payload = {
        "full_name": "Carlos Gomez",
        "document_type": "CC",
        "document": "30301",
        "phone": "3151234567",
        "email": "carlos@test.com"
    }
    res = client.post("/clients/", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["whatsapp_opt_in"] is False
    assert data["whatsapp_group_id"] is None
    assert data["whatsapp_group_name"] is None


def test_07_create_client_with_group_and_opt_in():
    groups = client.get("/whatsapp-groups/").json()
    group_id = groups[0]["id"]
    group_name = groups[0]["name"]

    payload = {
        "full_name": "Lucia Sanchez",
        "document_type": "CC",
        "document": "30302",
        "phone": "3209876543",
        "email": "lucia@test.com",
        "whatsapp_opt_in": True,
        "whatsapp_group_id": group_id
    }
    res = client.post("/clients/", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["whatsapp_opt_in"] is True
    assert data["whatsapp_group_id"] == group_id
    assert data["whatsapp_group_name"] == group_name


def test_08_create_client_with_foreign_group_rejected():
    payload = {
        "full_name": "Intruder User",
        "document_type": "CC",
        "document": "30303",
        "phone": "3000000000",
        "whatsapp_opt_in": True,
        "whatsapp_group_id": 99  # Belongs to Gym 2
    }
    res = client.post("/clients/", json=payload)
    assert res.status_code == 400
    assert "El grupo de WhatsApp no existe o pertenece a otro gimnasio" in res.json()["detail"]


def test_09_update_client_group_association():
    # Create client without group
    res_c = client.post("/clients/", json={
        "full_name": "Mateo Morales",
        "document_type": "CC",
        "document": "30304",
        "phone": "3111112233"
    })
    client_id = res_c.json()["id"]

    groups = client.get("/whatsapp-groups/").json()
    group_id = groups[0]["id"]

    # Assign group
    res_up = client.put(f"/clients/{client_id}", json={
        "whatsapp_group_id": group_id,
        "whatsapp_opt_in": True
    })
    assert res_up.status_code == 200
    assert res_up.json()["whatsapp_group_id"] == group_id

    # Foreign group update rejected
    res_foreign = client.put(f"/clients/{client_id}", json={
        "whatsapp_group_id": 99
    })
    assert res_foreign.status_code == 400


# ── SEARCH & FILTERS TESTS ───────────────────────────────────────────────────

def test_10_client_search_by_name_document_phone():
    # Search by Name
    res_name = client.get("/clients/?search=Lucia")
    assert res_name.status_code == 200
    items = res_name.json()["items"]
    assert any(c["full_name"] == "Lucia Sanchez" for c in items)

    # Search by Document
    res_doc = client.get("/clients/?search=30302")
    assert res_doc.status_code == 200
    items = res_doc.json()["items"]
    assert len(items) == 1
    assert items[0]["document"] == "30302"

    # Search by Phone
    res_phone = client.get("/clients/?search=3209876543")
    assert res_phone.status_code == 200
    items = res_phone.json()["items"]
    assert len(items) == 1
    assert items[0]["phone"] == "3209876543"


def test_11_client_filter_types():
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Add active membership expiring in 3 days for Lucia (document 30302)
    lucia = db.query(Client).filter(Client.document == "30302").first()
    mem_expiring = Membership(
        gym_id=1,
        client_id=lucia.id,
        membership_plan_id=1,
        start_date=now - timedelta(days=27),
        end_date=now + timedelta(days=3),
        base_price=Decimal("65000"),
        price=Decimal("65000"),
        status="ACTIVE",
        is_active=True
    )
    db.add(mem_expiring)

    # Add expired membership for Carlos (document 30301)
    carlos = db.query(Client).filter(Client.document == "30301").first()
    mem_expired = Membership(
        gym_id=1,
        client_id=carlos.id,
        membership_plan_id=1,
        start_date=now - timedelta(days=60),
        end_date=now - timedelta(days=30),
        base_price=Decimal("65000"),
        price=Decimal("65000"),
        status="EXPIRED",
        is_active=True
    )
    db.add(mem_expired)

    # Add pending balance in accounts receivable for Mateo (document 30304)
    mateo = db.query(Client).filter(Client.document == "30304").first()
    sale = Sale(
        gym_id=1,
        client_id=mateo.id,
        total=Decimal("50000"),
        status="PENDING",
    )
    db.add(sale)
    db.flush()

    ar = AccountsReceivable(
        gym_id=1,
        client_id=mateo.id,
        sale_id=sale.id,
        original_amount=Decimal("50000"),
        paid_amount=Decimal("0"),
        balance_due=Decimal("50000"),
        status="PENDING",
        due_date=now + timedelta(days=10)
    )
    db.add(ar)
    lucia_id = lucia.id
    carlos_id = carlos.id
    mateo_id = mateo.id

    db.commit()
    db.close()

    # Test expiring_membership filter
    res_expiring = client.get("/clients/?filter_type=expiring_membership")
    assert res_expiring.status_code == 200
    items_exp = res_expiring.json()["items"]
    assert any(c["id"] == lucia_id for c in items_exp)

    # Test expired_membership filter
    res_expired = client.get("/clients/?filter_type=expired_membership")
    assert res_expired.status_code == 200
    items_expired = res_expired.json()["items"]
    assert any(c["id"] == carlos_id for c in items_expired)

    # Test pending_balance filter
    res_pending = client.get("/clients/?filter_type=pending_balance")
    assert res_pending.status_code == 200
    items_pending = res_pending.json()["items"]
    assert any(c["id"] == mateo_id for c in items_pending)


# ── NOTIFICATION TEMPLATES & COMMUNICATIONS TESTS ─────────────────────────────

def test_12_create_custom_event_notification_template():
    template_payload = {
        "event_type": "CUSTOM_CUMPLEANOS",
        "channel": "WHATSAPP_WEB",
        "custom_event_name": "Cumpleaños del cliente",
        "description": "Mensaje especial para el cumpleaños de los afiliados",
        "template_body": "Hola {client_name} 🎉 Desde {gym_name} te deseamos un muy feliz cumpleaños!"
    }
    res = client.post("/notification-templates/", json=template_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["event_type"] == "CUSTOM_CUMPLEANOS"
    assert data["custom_event_name"] == "Cumpleaños del cliente"
    assert data["description"] == "Mensaje especial para el cumpleaños de los afiliados"


def test_13_prepare_communication_with_custom_template():
    db = TestingSessionLocal()
    lucia = db.query(Client).filter(Client.document == "30302").first()
    db.close()

    prepare_payload = {
        "client_id": lucia.id,
        "event_type": "CUSTOM_CUMPLEANOS"
    }
    res = client.post("/communications/prepare", json=prepare_payload)
    assert res.status_code == 200
    data = res.json()
    assert "Hola Lucia Sanchez 🎉 Desde Merwil ZonaFit te deseamos un muy feliz cumpleaños!" in data["rendered_message"]
    assert "undefined" not in data["rendered_message"]
    assert "None" not in data["rendered_message"]


def test_14_prepare_payment_received_message():
    db = TestingSessionLocal()
    lucia = db.query(Client).filter(Client.document == "30302").first()
    db.close()

    prepare_payload = {
        "client_id": lucia.id,
        "event_type": "PAYMENT_RECEIVED",
        "context_data": {
            "payment_concept": "Mensualidad Plan Full",
            "amount": "$65.000"
        }
    }
    res = client.post("/communications/prepare", json=prepare_payload)
    assert res.status_code == 200
    msg = res.json()["rendered_message"]
    assert "Hemos registrado correctamente tu pago en Merwil ZonaFit" in msg
    assert "Concepto:\nMensualidad Plan Full" in msg
    assert "Valor:\n$65.000" in msg


def test_15_prepare_group_invitation_message():
    db = TestingSessionLocal()
    lucia = db.query(Client).filter(Client.document == "30302").first()
    db.close()

    prepare_payload = {
        "client_id": lucia.id,
        "event_type": "GROUP_INVITATION"
    }
    res = client.post("/communications/prepare", json=prepare_payload)
    assert res.status_code == 200
    msg = res.json()["rendered_message"]
    assert "Tenemos un grupo de WhatsApp para mantenerte informado" in msg
    assert "https://chat.whatsapp.com/UpdatedLink999" in msg
    assert "¡Te esperamos! 💪" in msg
