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
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.membership_plan import MembershipPlan
from app.models.client import Client
from app.models.membership import Membership
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_plans_p12.db"
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
def setup_plans_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 & 2
    gym1 = Gym(id=1, name="Gym Uno", email="uno@gym.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Dos", email="dos@gym.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Active subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Owner Uno", email="owner1@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Owner Dos", email="owner2@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_plan_short_description():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Básico Corto",
        "description": "Acceso básico a sala de pesas.",
        "duration_days": 30,
        "price": 80000.0
    }
    response = client.post("/membership-plans/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["description"] == payload["description"]
    assert data["duration_days"] == 30
    assert float(data["price"]) == 80000.0


def test_02_create_plan_exact_255_chars_description():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    desc_255 = "A" * 255
    assert len(desc_255) == 255

    payload = {
        "name": "Plan Exacto 255",
        "description": desc_255,
        "duration_days": 60,
        "price": 150000.0
    }
    response = client.post("/membership-plans/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == desc_255
    assert len(data["description"]) == 255


def test_03_create_plan_more_than_255_chars_description():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    desc_350 = "Este es un plan premium con acceso ilimitado a todas las zonas del gimnasio: " + ("beneficio VIP " * 20)
    assert len(desc_350) > 255

    payload = {
        "name": "Plan Plus 350 Chars",
        "description": desc_350,
        "duration_days": 90,
        "price": 220000.0
    }
    response = client.post("/membership-plans/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == desc_350
    assert len(data["description"]) == len(desc_350)


def test_04_create_plan_large_description_1500_chars():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    desc_1500 = "ZonaFit Plan Black Anual: " + ("Incluye nutrición personalizada, sauna, casillero privado, toallas ilimitadas, clases grupales diarias y descuentos en suplementos. " * 12)
    assert len(desc_1500) > 1000

    payload = {
        "name": "Plan Mega Black 1500",
        "description": desc_1500,
        "duration_days": 365,
        "price": 950000.0
    }
    response = client.post("/membership-plans/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == desc_1500
    assert len(data["description"]) == len(desc_1500)


def test_05_get_plan_by_id_and_verify_exact_content():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    plan = db.query(MembershipPlan).filter(MembershipPlan.name == "Plan Mega Black 1500").first()
    assert plan is not None

    response = client.get(f"/membership-plans/{plan.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == plan.id
    assert data["description"] == plan.description
    assert len(data["description"]) > 1000


def test_06_update_plan_increasing_description_length():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    plan = db.query(MembershipPlan).filter(MembershipPlan.name == "Plan Básico Corto").first()
    assert plan is not None

    new_long_desc = "Descripción ampliada con múltiples detalles adicionales y reglamentos: " + ("Término legal " * 30)
    assert len(new_long_desc) > 300

    update_payload = {
        "description": new_long_desc
    }
    response = client.put(f"/membership-plans/{plan.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == new_long_desc
    assert data["name"] == "Plan Básico Corto"
    assert data["duration_days"] == 30
    assert float(data["price"]) == 80000.0


def test_07_update_plan_reducing_description_length():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    plan = db.query(MembershipPlan).filter(MembershipPlan.name == "Plan Básico Corto").first()
    assert plan is not None

    short_desc = "Descripción resumida corta."
    response = client.put(f"/membership-plans/{plan.id}", json={"description": short_desc})
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == short_desc
    assert data["duration_days"] == 30
    assert float(data["price"]) == 80000.0


def test_08_create_plan_optional_none_description():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Sin Descripción",
        "description": None,
        "duration_days": 15,
        "price": 45000.0
    }
    response = client.post("/membership-plans/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["description"] is None
    assert data["duration_days"] == 15


def test_09_multi_tenant_isolation_cannot_access_or_update_other_gym_plan():
    global current_test_user
    db = TestingSessionLocal()

    # Plan created in Gym 1
    plan_gym1 = db.query(MembershipPlan).filter(MembershipPlan.gym_id == 1).first()
    assert plan_gym1 is not None

    # Switch current user to Owner of Gym 2
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to GET plan of Gym 1
    response_get = client.get(f"/membership-plans/{plan_gym1.id}")
    assert response_get.status_code == 404

    # Attempt to PUT plan of Gym 1
    response_put = client.put(f"/membership-plans/{plan_gym1.id}", json={"name": "Hacked Plan"})
    assert response_put.status_code == 404

    # Attempt to DELETE plan of Gym 1
    response_del = client.delete(f"/membership-plans/{plan_gym1.id}")
    assert response_del.status_code == 404


def test_10_compatibility_membership_creation_with_long_description_plan():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create a client for Gym 1
    client_obj = Client(
        gym_id=1,
        full_name="Juan Pérez",
        document_type="CC",
        document="12345678",
        phone="3001234567",
        email="juan.perez@test.com",
        is_active=True
    )
    db.add(client_obj)
    db.commit()

    plan = db.query(MembershipPlan).filter(MembershipPlan.name == "Plan Mega Black 1500").first()
    assert plan is not None

    # Sell/assign membership based on this plan
    membership_payload = {
        "client_id": client_obj.id,
        "membership_plan_id": plan.id,
        "trainer_name": "Entrenador Pro"
    }
    response = client.post("/memberships/", json=membership_payload)
    assert response.status_code == 201
    mem_data = response.json()
    assert mem_data["client_id"] == client_obj.id
    assert mem_data["membership_plan_id"] == plan.id
    assert mem_data["status"] == "ACTIVE"
