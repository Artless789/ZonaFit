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
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_membership_plan_periodicity_p25.db"
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
def setup_p25_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Power Gym Alpha", email="alpha@gym.com", owner_id=1)
    gym2 = Gym(id=2, name="Cross Gym Beta", email="beta@gym.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin Gym 1", email="admin1@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Gym 2", email="admin2@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Clients for Gym 1 & Gym 2
    c1 = Client(id=1, gym_id=1, full_name="Juan Perez", document_type="CC", document="1001", phone="3001234567", email="juan@perez.com", is_active=True)
    c2 = Client(id=2, gym_id=2, full_name="Maria Lopez", document_type="CC", document="2002", phone="3009876543", email="maria@lopez.com", is_active=True)
    db.add_all([c1, c2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# 1. Crear plan con duración válida
def test_01_create_membership_plan_valid_duration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Mensual VIP",
        "description": "Acceso ilimitado por 30 días",
        "duration_days": 30,
        "price": 120000.00
    }
    resp = client.post("/membership-plans/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Plan Mensual VIP"
    assert data["duration_days"] == 30
    assert float(data["price"]) == 120000.00
    assert data["gym_id"] == 1


# 2. Consultar plan mostrando duración/periodicidad
def test_02_get_membership_plan_with_duration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/membership-plans/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["duration_days"] == 30
    assert data["name"] == "Plan Mensual VIP"


# 3. Actualizar duración del plan
def test_03_update_membership_plan_duration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "duration_days": 45
    }
    resp = client.put("/membership-plans/1", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["duration_days"] == 45

    # Revert back to 30 for subsequent tests
    client.put("/membership-plans/1", json={"duration_days": 30})


# 4. Rechazar duración cero
def test_04_reject_duration_zero():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Inválido Cero",
        "duration_days": 0,
        "price": 50000.00
    }
    resp = client.post("/membership-plans/", json=payload)
    assert resp.status_code in [400, 422]


# 5. Rechazar duración negativa
def test_05_reject_duration_negative():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Negativo",
        "duration_days": -15,
        "price": 50000.00
    }
    resp = client.post("/membership-plans/", json=payload)
    assert resp.status_code in [400, 422]

    # Test update with negative duration
    resp_update = client.put("/membership-plans/1", json={"duration_days": -10})
    assert resp_update.status_code in [400, 422]


# 6 & 7. Crear membresía utilizando la duración del plan y calcular correctamente fecha de vencimiento
def test_06_and_07_create_membership_calculates_expiry_date():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create 7-day plan
    resp_p7 = client.post("/membership-plans/", json={
        "name": "Pase Semanal",
        "duration_days": 7,
        "price": 35000.00
    })
    assert resp_p7.status_code == 201
    p7_id = resp_p7.json()["id"]

    # Create 90-day plan
    resp_p90 = client.post("/membership-plans/", json={
        "name": "Plan Trimestral",
        "duration_days": 90,
        "price": 300000.00
    })
    assert resp_p90.status_code == 201
    p90_id = resp_p90.json()["id"]

    # Assign 30-day plan (id=1) to client 1
    resp_mem = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1
    })
    assert resp_mem.status_code == 201
    mem_data = resp_mem.json()

    start_dt = datetime.fromisoformat(mem_data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(mem_data["end_date"].replace("Z", "+00:00"))
    delta_days = (end_dt - start_dt).days

    assert delta_days == 30
    assert float(mem_data["price"]) == 120000.00


# 8. Cambiar duración del plan NO modifica membresías existentes
def test_08_update_plan_duration_preserves_existing_membership():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Existing membership (id=1) has 30 days
    db_mem_before = db.query(Membership).filter(Membership.id == 1).first()
    original_end_date = db_mem_before.end_date

    # Update plan 1 duration to 60 days
    resp = client.put("/membership-plans/1", json={"duration_days": 60})
    assert resp.status_code == 200

    # Verify existing membership end_date is strictly unmodified
    db.expire_all()
    db_mem_after = db.query(Membership).filter(Membership.id == 1).first()
    assert db_mem_after.end_date == original_end_date


# 9. Nueva membresía utiliza la nueva duración del plan
def test_09_new_membership_uses_updated_duration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create new client
    new_client = Client(gym_id=1, full_name="Carlos Gomez", document_type="CC", document="3003", phone="3115556677", email="carlos@gomez.com", is_active=True)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    # Assign updated plan (duration=60)
    resp_mem = client.post("/memberships/", json={
        "client_id": new_client.id,
        "membership_plan_id": 1
    })
    assert resp_mem.status_code == 201
    mem_data = resp_mem.json()

    start_dt = datetime.fromisoformat(mem_data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(mem_data["end_date"].replace("Z", "+00:00"))
    delta_days = (end_dt - start_dt).days

    assert delta_days == 60


# 10. Aislamiento multi-tenant de planes
def test_10_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to Gym 2 user
    current_test_user = db.query(User).filter(User.id == 2).first()

    # Gym 2 tries to read Gym 1 plan (id=1)
    resp = client.get("/membership-plans/1")
    assert resp.status_code == 404

    # Gym 2 tries to update Gym 1 plan
    resp_update = client.put("/membership-plans/1", json={"duration_days": 100})
    assert resp_update.status_code == 404

    # Gym 2 creates their own plan
    resp_create = client.post("/membership-plans/", json={
        "name": "Plan Beta 15 Días",
        "duration_days": 15,
        "price": 60000.00
    })
    assert resp_create.status_code == 201
    assert resp_create.json()["gym_id"] == 2


# 11. No permitir crear membresía con plan perteneciente a otro gimnasio
def test_11_cannot_create_membership_with_foreign_plan():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to Gym 2 user
    current_test_user = db.query(User).filter(User.id == 2).first()

    # Client 2 belongs to Gym 2, Plan 1 belongs to Gym 1
    resp = client.post("/memberships/", json={
        "client_id": 2,
        "membership_plan_id": 1
    })
    assert resp.status_code == 404


# 12. Preservar precio histórico de Membership (P1.6 congelamiento de precio)
def test_12_historical_price_preservation():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Check price of membership 1
    db_mem = db.query(Membership).filter(Membership.id == 1).first()
    original_price = db_mem.price
    assert float(original_price) == 120000.00

    # Update plan price from 120000 to 180000
    resp = client.put("/membership-plans/1", json={"price": 180000.00})
    assert resp.status_code == 200

    # Verify existing membership keeps 120000.00
    db.expire_all()
    db_mem_after = db.query(Membership).filter(Membership.id == 1).first()
    assert float(db_mem_after.price) == 120000.00
