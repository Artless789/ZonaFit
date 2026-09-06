import pytest
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
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_clients_p19.db"
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
def setup_clients_db():
    from app.database.base import Base
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
    db.add_all([user1, user2])
    db.commit()

    # Initial clients for Gym 1 & Gym 2
    c1 = Client(id=1, gym_id=1, full_name="Carlos Activo", document_type="CC", document="11111", phone="3001111111", email="carlos@gmail.com", is_active=True)
    c2 = Client(id=2, gym_id=1, full_name="Diana Inactiva", document_type="CC", document="22222", phone="3002222222", email="diana@gmail.com", is_active=False)
    c_beta = Client(id=3, gym_id=2, full_name="Pedro Beta", document_type="CC", document="33333", phone="3003333333", email="pedro@gmail.com", is_active=True)
    db.add_all([c1, c2, c_beta])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_client_defaults_to_active():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "full_name": "Nuevo Afiliado",
        "document_type": "CC",
        "document": "44444",
        "phone": "3004444444",
        "email": "nuevo@afiliado.com",
        "notes": "Cliente recién registrado"
    }
    response = client.post("/clients/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_active"] is True
    assert data["full_name"] == "Nuevo Afiliado"
    assert data["gym_id"] == 1


def test_02_active_client_can_be_deactivated_via_delete():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Soft delete client 1
    del_resp = client.delete("/clients/1")
    assert del_resp.status_code == 204

    # Verify is_active is now False
    get_resp = client.get("/clients/1")
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False


def test_03_active_client_can_be_deactivated_via_put():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Deactivate client 4 (Nuevo Afiliado) via PUT
    put_resp = client.put("/clients/4", json={"is_active": False})
    assert put_resp.status_code == 200
    assert put_resp.json()["is_active"] is False


def test_04_inactive_client_can_be_reactivated_via_put():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Reactivate client 1 (Carlos) via PUT
    put_resp = client.put("/clients/1", json={"is_active": True})
    assert put_resp.status_code == 200
    assert put_resp.json()["is_active"] is True

    # Reactivate client 2 (Diana) via PUT
    put_resp2 = client.put("/clients/2", json={"is_active": True})
    assert put_resp2.status_code == 200
    assert put_resp2.json()["is_active"] is True


def test_05_client_status_persists_after_reload():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Query via GET /clients/1
    resp = client.get("/clients/1")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    # Query via GET /clients/4
    resp4 = client.get("/clients/4")
    assert resp4.status_code == 200
    assert resp4.json()["is_active"] is False


def test_06_filter_clients_by_active_status():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Currently in Gym 1:
    # Client 1 (Carlos) -> is_active = True
    # Client 2 (Diana) -> is_active = True
    # Client 4 (Nuevo) -> is_active = False

    resp = client.get("/clients/?is_active=true")
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert len(items) == 2
    for item in items:
        assert item["is_active"] is True


def test_07_filter_clients_by_inactive_status():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/clients/?is_active=false")
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert len(items) == 1
    assert items[0]["id"] == 4
    assert items[0]["is_active"] is False


def test_08_status_change_preserves_client_data_and_history():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Get client 1 before
    c_before = client.get("/clients/1").json()

    # Deactivate and Reactivate
    client.put("/clients/1", json={"is_active": False})
    c_inactive = client.get("/clients/1").json()
    assert c_inactive["is_active"] is False
    assert c_inactive["full_name"] == c_before["full_name"]
    assert c_inactive["document"] == c_before["document"]
    assert c_inactive["phone"] == c_before["phone"]
    assert c_inactive["email"] == c_before["email"]

    client.put("/clients/1", json={"is_active": True})
    c_active = client.get("/clients/1").json()
    assert c_active["is_active"] is True
    assert c_active["full_name"] == c_before["full_name"]
    assert c_active["document"] == c_before["document"]
    assert c_active["phone"] == c_before["phone"]
    assert c_active["email"] == c_before["email"]


def test_09_multi_tenant_isolation_for_client_status():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # GET /clients/ of Gym 2 should return only Client 3 (Pedro Beta)
    resp = client.get("/clients/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == 3
    assert data["items"][0]["gym_id"] == 2


def test_10_foreign_client_status_change_is_rejected():
    global current_test_user
    db = TestingSessionLocal()

    # User of Gym 2 attempts to GET, PUT, or DELETE Client 1 (Gym 1)
    current_test_user = db.query(User).filter(User.id == 2).first()

    resp_get = client.get("/clients/1")
    assert resp_get.status_code == 404

    resp_put = client.put("/clients/1", json={"is_active": False})
    assert resp_put.status_code == 404

    resp_del = client.delete("/clients/1")
    assert resp_del.status_code == 404


def test_11_duplicate_document_validation_on_client_create_and_update():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Attempt to create client with duplicate document '11111'
    resp_dup = client.post("/clients/", json={
        "full_name": "Otro Carlos",
        "document_type": "CC",
        "document": "11111",
        "phone": "3009998877"
    })
    assert resp_dup.status_code == 400
    assert "Client already exists" in resp_dup.json()["detail"]

    # Attempt to update client 2 with document of client 1 ('11111')
    resp_put_dup = client.put("/clients/2", json={"document": "11111"})
    assert resp_put_dup.status_code == 400
    assert "Another client already has this document" in resp_put_dup.json()["detail"]
