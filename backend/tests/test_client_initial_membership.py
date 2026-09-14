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
from app.models.cash_register import CashRegister
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_client_initial_membership.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == 'Connection':
        dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_get_current_user():
    db = TestingSessionLocal()
    return db.query(User).filter(User.id == 1).first()

app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    gym = Gym(id=1, name="Unified Client Gym", email="unified@gym.com", owner_id=1, is_active=True)
    db.add(gym)
    
    user = User(
        id=1,
        gym_id=1,
        email="owner@unifiedgym.com",
        full_name="Owner Unified",
        password=hash_password("Pass1234"),
        role="OWNER",
        is_active=True
    )
    db.add(user)
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub = Subscription(
        id=1,
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True
    )
    db.add(sub)
    
    plan = MembershipPlan(
        id=1,
        gym_id=1,
        name="Plan Mensual Estándar",
        description="Acceso ilimitado",
        duration_days=30,
        price=Decimal("90000.00"),
        is_active=True
    )
    db.add(plan)
    
    register = CashRegister(
        id=1,
        gym_id=1,
        opened_by=1,
        opening_balance=Decimal("20000.00"),
        status="OPEN"
    )
    db.add(register)
    
    db.commit()
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)


def test_create_client_without_initial_membership():
    response = client.post(
        "/clients/",
        json={
            "full_name": "Laura Perez",
            "document_type": "CC",
            "document": "98765432",
            "phone": "3109876543",
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Laura Perez"
    assert data["document"] == "98765432"
    assert data.get("initial_membership") is None


def test_create_client_with_initial_membership_and_payment():
    response = client.post(
        "/clients/",
        json={
            "full_name": "Mateo Morales",
            "document_type": "CC",
            "document": "11223344",
            "phone": "3112233445",
            "initial_membership": {
                "membership_plan_id": 1,
                "discount": 10000.0,
                "register_payment": True,
                "payment_method": "CASH",
                "amount_paid": 80000.0
            }
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "Mateo Morales"
    assert data["initial_membership"] is not None
    mem = data["initial_membership"]
    assert mem["base_price"] == 90000.0
    assert mem["discount"] == 10000.0
    assert mem["price"] == 80000.0
    assert mem["total_paid"] == 80000.0
    assert mem["pending_balance"] == 0.0

    # Verify membership exists in DB
    db = TestingSessionLocal()
    db_mem = db.query(Membership).filter(Membership.client_id == data["id"]).first()
    assert db_mem is not None
    assert float(db_mem.price) == 80000.0
    db.close()


def test_create_client_with_initial_membership_rollback_on_invalid_amount():
    # If payment exceeds plan price, the entire transaction (client + membership) must rollback
    response = client.post(
        "/clients/",
        json={
            "full_name": "Failing Client",
            "document_type": "CC",
            "document": "99999999",
            "phone": "3000000000",
            "initial_membership": {
                "membership_plan_id": 1,
                "discount": 0.0,
                "register_payment": True,
                "payment_method": "CASH",
                "amount_paid": 999999.0  # Exceeds plan price 90,000
            }
        }
    )
    assert response.status_code == 400
    assert "no puede superar el total" in response.json()["detail"]

    # Verify client was NOT persisted in DB
    db = TestingSessionLocal()
    db_client = db.query(Client).filter(Client.document == "99999999").first()
    assert db_client is None
    db.close()
