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
from app.models.cash_movement import CashMovement
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_memberships_p16.db"
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
def setup_memberships_db():
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

    # Membership Plans
    plan1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual", price=120000.0, duration_days=30, is_active=True)
    plan2 = MembershipPlan(id=2, gym_id=1, name="Plan Anual", price=1000000.0, duration_days=365, is_active=True)
    plan_beta = MembershipPlan(id=3, gym_id=2, name="Plan Beta Mensual", price=130000.0, duration_days=30, is_active=True)
    db.add_all([plan1, plan2, plan_beta])

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Carlos Gomez", document_type="CC", document="10101", phone="3001010101", is_active=True)
    client2 = Client(id=2, gym_id=1, full_name="Ana Martinez", document_type="CC", document="20202", phone="3002020202", is_active=True)
    client_beta = Client(id=3, gym_id=2, full_name="Pedro Beta", document_type="CC", document="30303", phone="3003030303", is_active=True)
    db.add_all([client1, client2, client_beta])

    # Cash Registers
    cash_reg1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=50000.0, status="OPEN")
    cash_reg2 = CashRegister(id=2, gym_id=2, opened_by=2, opening_balance=50000.0, status="OPEN")
    db.add_all([cash_reg1, cash_reg2])

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_membership_from_plan():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "client_id": 1,
        "membership_plan_id": 1,
        "trainer_name": "Coach Carlos"
    }
    response = client.post("/memberships/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["client_id"] == 1
    assert data["membership_plan_id"] == 1
    assert float(data["price"]) == 120000.0
    assert data["status"] == "ACTIVE"
    assert data["gym_id"] == 1


def test_02_membership_preserves_historical_plan_price():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create membership with Plan 1 (price: 120,000)
    mem_resp = client.post("/memberships/", json={"client_id": 2, "membership_plan_id": 1})
    assert mem_resp.status_code == 201
    mem_id = mem_resp.json()["id"]

    # 2. Update Plan 1 price to 160,000 COP
    plan_update = client.put("/membership-plans/1", json={"price": 160000.0})
    assert plan_update.status_code == 200

    # 3. Retrieve membership and verify price is STILL 120,000 COP
    get_mem = client.get(f"/memberships/{mem_id}")
    assert get_mem.status_code == 200
    assert float(get_mem.json()["price"]) == 120000.0


def test_03_full_membership_payment():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Membership 1 was created with price 120,000
    pay_resp = client.post("/payments/", json={
        "membership_id": 1,
        "payment_method": "CASH"
    })
    assert pay_resp.status_code == 201
    data = pay_resp.json()
    assert float(data["amount"]) == 120000.0
    assert data["payment_method"] == "CASH"
    assert data["status"] == "PAID"


def test_04_partial_membership_payment():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create new membership with Plan 2 (price: 1,000,000 COP)
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 2})
    assert mem_resp.status_code == 201
    mem_id = mem_resp.json()["id"]

    # Make partial payment of 400,000 COP
    pay_resp = client.post("/payments/", json={
        "membership_id": mem_id,
        "amount": 400000.0,
        "payment_method": "CASH"
    })
    assert pay_resp.status_code == 201
    assert float(pay_resp.json()["amount"]) == 400000.0


def test_05_second_payment_closes_membership_balance():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Membership with price 1,000,000 has 400,000 paid. Remaining balance = 600,000.
    # Pay remaining 600,000 without specifying amount (should auto-fill remaining balance)
    pay_resp = client.post("/payments/", json={
        "membership_id": 3,
        "payment_method": "CARD"
    })
    assert pay_resp.status_code == 201
    assert float(pay_resp.json()["amount"]) == 600000.0


def test_06_cannot_pay_more_than_membership_balance():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Membership 3 is already fully paid (400k + 600k = 1M). Attempting any further payment should fail.
    pay_resp = client.post("/payments/", json={
        "membership_id": 3,
        "amount": 50000.0,
        "payment_method": "CASH"
    })
    assert pay_resp.status_code == 400


def test_07_multiple_payments_preserve_total_integrity():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create membership (Plan 1: 160,000)
    mem_resp = client.post("/memberships/", json={"client_id": 2, "membership_plan_id": 1})
    mem_id = mem_resp.json()["id"]

    # Payment 1: 50,000
    p1 = client.post("/payments/", json={"membership_id": mem_id, "amount": 50000.0, "payment_method": "CASH"})
    assert p1.status_code == 201

    # Payment 2: 70,000
    p2 = client.post("/payments/", json={"membership_id": mem_id, "amount": 70000.0, "payment_method": "TRANSFER"})
    assert p2.status_code == 201

    # Payment 3: 40,000
    p3 = client.post("/payments/", json={"membership_id": mem_id, "amount": 40000.0, "payment_method": "CARD"})
    assert p3.status_code == 201

    # Verify total payments = 160,000
    payments = db.query(Payment).filter(Payment.membership_id == mem_id).all()
    assert len(payments) == 3
    assert sum(p.amount for p in payments) == Decimal("160000.00")


def test_08_cash_membership_payment_creates_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create new membership
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1})
    mem_id = mem_resp.json()["id"]

    # Pay 80,000 in CASH
    pay_resp = client.post("/payments/", json={"membership_id": mem_id, "amount": 80000.0, "payment_method": "CASH"})
    assert pay_resp.status_code == 201
    pay_id = pay_resp.json()["id"]

    # Verify CashMovement in DB
    cash_mov = db.query(CashMovement).filter(CashMovement.payment_id == pay_id).first()
    assert cash_mov is not None
    assert cash_mov.type == "IN"
    assert cash_mov.category == "MEMBERSHIP_PAYMENT"
    assert float(cash_mov.amount) == 80000.0


def test_09_card_membership_payment_does_not_create_physical_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1})
    mem_id = mem_resp.json()["id"]

    # Pay in CARD
    pay_resp = client.post("/payments/", json={"membership_id": mem_id, "amount": 80000.0, "payment_method": "CARD"})
    assert pay_resp.status_code == 201
    pay_id = pay_resp.json()["id"]

    # Verify NO CashMovement created
    cash_mov = db.query(CashMovement).filter(CashMovement.payment_id == pay_id).first()
    assert cash_mov is None


def test_10_multi_tenant_isolation_membership():
    global current_test_user
    db = TestingSessionLocal()

    # Membership belongs to Gym 1
    mem_gym1 = db.query(Membership).filter(Membership.gym_id == 1).first()
    assert mem_gym1 is not None

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to GET membership of Gym 1
    resp_get = client.get(f"/memberships/{mem_gym1.id}")
    assert resp_get.status_code == 404

    # Attempt to DELETE membership of Gym 1
    resp_del = client.delete(f"/memberships/{mem_gym1.id}")
    assert resp_del.status_code == 404


def test_11_multi_tenant_isolation_membership_payment():
    global current_test_user
    db = TestingSessionLocal()

    # Membership belongs to Gym 1
    mem_gym1 = db.query(Membership).filter(Membership.gym_id == 1).first()

    # Switch to User of Gym 2
    current_test_user = db.query(User).filter(User.id == 2).first()

    # Attempt to register Payment on Gym 1's membership
    pay_resp = client.post("/payments/", json={
        "membership_id": mem_gym1.id,
        "amount": 50000.0,
        "payment_method": "CASH"
    })
    assert pay_resp.status_code == 404


def test_12_cannot_create_membership_with_foreign_client_or_plan():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to User of Gym 2
    current_test_user = db.query(User).filter(User.id == 2).first()

    # Attempt to create membership in Gym 2 using Plan 1 (Gym 1)
    resp1 = client.post("/memberships/", json={"client_id": 3, "membership_plan_id": 1})
    assert resp1.status_code == 404

    # Attempt to create membership in Gym 2 using Client 1 (Gym 1)
    resp2 = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 3})
    assert resp2.status_code == 404
