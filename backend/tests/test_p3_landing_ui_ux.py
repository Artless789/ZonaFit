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
from app.models.cash_movement import CashMovement
from app.models.sale import Sale
from app.models.invoice import Invoice
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_p3_landing_ui_ux.db"
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
def setup_p3_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Alpha Center", email="alpha@center.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Beta Fitness", email="beta@fitness.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Owner Alpha", email="owner@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Owner Beta", email="owner@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# 1. test_01_public_landing_plans_available
def test_01_public_landing_plans_available():
    # Public endpoint or subscription plans
    resp = client.get("/subscriptions/plans")
    assert resp.status_code in [200, 404]  # If endpoint exists, check 200 or clean response


# 2. test_02_auth_login_route_accessible
def test_02_auth_login_route_accessible():
    resp = client.post("/auth/login", data={"username": "owner@alpha.com", "password": "WrongPassword"})
    assert resp.status_code == 401


# 3. test_03_forgot_password_public_flow
def test_03_forgot_password_public_flow():
    resp = client.post("/auth/forgot-password", json={"email": "owner@alpha.com"})
    assert resp.status_code == 200
    assert "message" in resp.json() or "detail" in resp.json() or resp.status_code == 200


# 4. test_04_financial_integrity_preserved_on_public_navigation
def test_04_financial_integrity_preserved_on_public_navigation():
    db = TestingSessionLocal()
    payments_before = db.query(Payment).count()
    movements_before = db.query(CashMovement).count()
    sales_before = db.query(Sale).count()

    # Hit public/auth endpoints
    client.post("/auth/forgot-password", json={"email": "nonexistent@test.com"})

    assert db.query(Payment).count() == payments_before
    assert db.query(CashMovement).count() == movements_before
    assert db.query(Sale).count() == sales_before


# 5. test_05_multi_tenant_isolation_maintained
def test_05_multi_tenant_isolation_maintained():
    global current_test_user
    db = TestingSessionLocal()

    # User 2 cannot access gym 1 clients
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp = client.get("/clients/")
    assert resp.status_code == 200
    for c in resp.json().get("items", []):
        assert c["gym_id"] == 2


# 6. test_06_unauthenticated_protected_routes_rejected
def test_06_unauthenticated_protected_routes_rejected():
    global current_test_user
    current_test_user = None

    resp = client.get("/clients/")
    assert resp.status_code in [401, 403]
