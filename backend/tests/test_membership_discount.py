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
from app.models.payment import Payment
from app.models.cash_register import CashRegister
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.accounts_receivable import AccountsReceivable
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_membership_discount.db"
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
    db = TestingSessionLocal()
    user = db.query(User).filter(User.id == 1).first()
    return user

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
    
    gym = Gym(id=1, name="Discount Test Gym", email="discount@gym.com", owner_id=1, is_active=True)
    db.add(gym)
    
    user = User(
        id=1,
        gym_id=1,
        email="owner@discountgym.com",
        full_name="Owner User",
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
        name="Plan Mensual VIP",
        description="Acceso total",
        duration_days=30,
        price=Decimal("100000.00"),
        is_active=True
    )
    db.add(plan)
    
    customer = Client(
        id=1,
        gym_id=1,
        full_name="Carlos Gomez",
        document_type="CC",
        document="12345678",
        phone="3001234567",
        is_active=True
    )
    db.add(customer)
    
    register = CashRegister(
        id=1,
        gym_id=1,
        opened_by=1,
        opening_balance=Decimal("50000.00"),
        status="OPEN"
    )
    db.add(register)
    
    db.commit()
    db.close()
    
    global current_test_user
    current_test_user = user
    
    yield
    
    Base.metadata.drop_all(bind=engine)


def test_membership_creation_with_discount():
    # Plan is 100,000 COP. We apply 20,000 COP discount.
    # Net price must be 80,000 COP.
    response = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "discount": 20000.0,
            "register_payment": False
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["base_price"] == 100000.0
    assert data["discount"] == 20000.0
    assert data["price"] == 80000.0
    assert data["pending_balance"] == 80000.0

    # Verify MembershipPlan price remained unchanged at 100,000.00
    db = TestingSessionLocal()
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == 1).first()
    assert float(plan.price) == 100000.0
    db.close()


def test_membership_with_discount_and_full_payment():
    # Plan 100,000, discount 30,000 -> net price 70,000.
    # Pay 70,000 in cash.
    response = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "discount": 30000.0,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 70000.0
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["price"] == 70000.0
    assert data["total_paid"] == 70000.0
    assert data["pending_balance"] == 0.0

    # No accounts receivable should be created
    db = TestingSessionLocal()
    ars = db.query(AccountsReceivable).filter(AccountsReceivable.client_id == 1).all()
    assert len(ars) == 0
    db.close()


def test_membership_with_discount_and_partial_payment():
    # Plan 100,000, discount 15,000 -> net price 85,000.
    # Pay 35,000 -> pending balance 50,000.
    response = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "discount": 15000.0,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 35000.0
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["base_price"] == 100000.0
    assert data["discount"] == 15000.0
    assert data["price"] == 85000.0
    assert data["total_paid"] == 35000.0
    assert data["pending_balance"] == 50000.0

    # Accounts receivable must reflect 85,000 original amount and 50,000 balance due (not 100,000!)
    db = TestingSessionLocal()
    ar = db.query(AccountsReceivable).filter(AccountsReceivable.client_id == 1).first()
    assert ar is not None
    assert float(ar.original_amount) == 85000.0
    assert float(ar.paid_amount) == 35000.0
    assert float(ar.balance_due) == 50000.0
    assert ar.status == "PARTIAL"
    db.close()


def test_cannot_apply_discount_greater_than_plan_price():
    # Plan is 100,000. Discount of 120,000 should be rejected.
    response = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "discount": 120000.0,
            "register_payment": False
        }
    )
    assert response.status_code == 400
    assert "no puede superar el precio base" in response.json()["detail"]


def test_cannot_apply_negative_discount():
    # Negative discount must be rejected
    response = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "discount": -5000.0,
            "register_payment": False
        }
    )
    assert response.status_code == 400
    assert "no puede ser negativo" in response.json()["detail"]
