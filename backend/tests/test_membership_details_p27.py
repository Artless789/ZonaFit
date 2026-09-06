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

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_membership_details_p27.db"
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
def setup_p27_db():
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

    # Initial Clients
    c1 = Client(id=1, gym_id=1, full_name="Carlos Perez", document_type="CC", document="1001", phone="3001234567", email="carlos@perez.com", is_active=True)
    c2 = Client(id=2, gym_id=2, full_name="Maria Gomez", document_type="CC", document="2002", phone="3009876543", email="maria@gomez.com", is_active=True)
    db.add_all([c1, c2])

    # Initial Plans
    p1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual VIP", description="Acceso completo gym", duration_days=30, price=Decimal("120000.00"), is_active=True)
    p2 = MembershipPlan(id=2, gym_id=2, name="Plan Beta", description="Acceso Beta", duration_days=30, price=Decimal("150000.00"), is_active=True)
    db.add_all([p1, p2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# 1. test_01_get_membership_detail
def test_01_get_membership_detail():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create a membership for Client 1
    resp_create = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1,
        "trainer_name": "Coach Alexander"
    })
    assert resp_create.status_code == 201
    mem_id = resp_create.json()["id"]

    # Query detail
    resp = client.get(f"/memberships/{mem_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == mem_id
    assert data["gym_id"] == 1
    assert data["client_id"] == 1
    assert data["membership_plan_id"] == 1
    assert float(data["price"]) == 120000.00
    assert data["status"] == "ACTIVE"
    assert data["trainer_name"] == "Coach Alexander"


# 2. test_02_membership_detail_contains_client_information
def test_02_membership_detail_contains_client_information():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert "client" in data and data["client"] is not None
    client_info = data["client"]
    assert client_info["id"] == 1
    assert client_info["full_name"] == "Carlos Perez"
    assert client_info["document_type"] == "CC"
    assert client_info["document"] == "1001"
    assert client_info["phone"] == "3001234567"
    assert client_info["email"] == "carlos@perez.com"


# 3. test_03_membership_detail_contains_plan_information
def test_03_membership_detail_contains_plan_information():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert "membership_plan" in data and data["membership_plan"] is not None
    plan_info = data["membership_plan"]
    assert plan_info["id"] == 1
    assert plan_info["name"] == "Plan Mensual VIP"
    assert plan_info["description"] == "Acceso completo gym"
    assert plan_info["duration_days"] == 30
    assert float(plan_info["price"]) == 120000.00


# 4. test_04_membership_preserves_historical_price
def test_04_membership_preserves_historical_price():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Modify plan 1 price from 120000 to 180000
    resp_up = client.put("/membership-plans/1", json={"price": 180000.00})
    assert resp_up.status_code == 200

    # Membership 1 must STILL have historical price 120000
    resp_mem = client.get("/memberships/1")
    assert resp_mem.status_code == 200
    data = resp_mem.json()
    assert float(data["price"]) == 120000.00


# 5. test_05_membership_preserves_historical_dates
def test_05_membership_preserves_historical_dates():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Modify plan 1 duration from 30 to 60 days
    resp_up = client.put("/membership-plans/1", json={"duration_days": 60})
    assert resp_up.status_code == 200

    # Membership 1 must STILL have its original 30 days validity span
    resp_mem = client.get("/memberships/1")
    assert resp_mem.status_code == 200
    data = resp_mem.json()
    start_dt = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
    assert (end_dt - start_dt).days == 30


# 6. test_06_membership_detail_contains_payment_history
def test_06_membership_detail_contains_payment_history():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Add a payment for membership 1
    pmt1 = Payment(gym_id=1, membership_id=1, amount=Decimal("50000.00"), payment_method="CASH", reference="REC-001", status="PAID", is_active=True)
    db.add(pmt1)
    db.commit()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert "payments" in data
    assert len(data["payments"]) == 1
    p = data["payments"][0]
    assert float(p["amount"]) == 50000.00
    assert p["payment_method"] == "CASH"
    assert p["reference"] == "REC-001"


# 7. test_07_partial_payment_reflects_real_paid_amount
def test_07_partial_payment_reflects_real_paid_amount():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_paid"]) == 50000.00
    assert float(data["pending_balance"]) == 70000.00


# 8. test_08_multiple_payment_methods_are_preserved
def test_08_multiple_payment_methods_are_preserved():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Add a second payment via TRANSFER and a third via CARD on a new membership
    pmt2 = Payment(gym_id=1, membership_id=1, amount=Decimal("70000.00"), payment_method="TRANSFER", reference="TR-998877", status="PAID", is_active=True)
    db.add(pmt2)
    db.commit()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    methods = [p["payment_method"] for p in data["payments"]]
    assert "CASH" in methods
    assert "TRANSFER" in methods


# 9. test_09_membership_detail_calculates_balance_from_payments
def test_09_membership_detail_calculates_balance_from_payments():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["total_paid"]) == 120000.00
    assert float(data["pending_balance"]) == 0.00


# 10. test_10_multi_tenant_membership_detail_isolation
def test_10_multi_tenant_membership_detail_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 2 user attempts to get Gym 1 membership 1
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp = client.get("/memberships/1")
    assert resp.status_code == 404


# 11. test_11_foreign_related_payment_is_not_exposed
def test_11_foreign_related_payment_is_not_exposed():
    global current_test_user
    db = TestingSessionLocal()

    # Create membership 2 in Gym 2
    mem2 = Membership(gym_id=2, client_id=2, membership_plan_id=2, start_date=datetime.now(timezone.utc), end_date=datetime.now(timezone.utc) + timedelta(days=30), price=Decimal("150000.00"), status="ACTIVE", is_active=True)
    db.add(mem2)
    db.commit()
    db.refresh(mem2)

    # Add payment for Gym 2
    pmt_g2 = Payment(gym_id=2, membership_id=mem2.id, amount=Decimal("150000.00"), payment_method="CARD", reference="CARD-001", status="PAID", is_active=True)
    db.add(pmt_g2)
    db.commit()

    # Switch to Gym 1 user and query Gym 1 membership
    current_test_user = db.query(User).filter(User.id == 1).first()
    resp_alpha = client.get("/memberships/1")
    assert resp_alpha.status_code == 200
    payments_alpha = resp_alpha.json()["payments"]
    for pmt in payments_alpha:
        assert pmt["payment_method"] != "CARD"
        assert pmt["reference"] != "CARD-001"


# 12. test_12_membership_detail_does_not_modify_financial_state
def test_12_membership_detail_does_not_modify_financial_state():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Count financial records before
    payments_count_before = db.query(Payment).count()
    cash_movements_count_before = db.query(CashMovement).count()
    sales_count_before = db.query(Sale).count()
    invoices_count_before = db.query(Invoice).count()
    memberships_count_before = db.query(Membership).count()

    # Read detail 5 times
    for _ in range(5):
        resp = client.get("/memberships/1")
        assert resp.status_code == 200

    # Count financial records after
    assert db.query(Payment).count() == payments_count_before
    assert db.query(CashMovement).count() == cash_movements_count_before
    assert db.query(Sale).count() == sales_count_before
    assert db.query(Invoice).count() == invoices_count_before
    assert db.query(Membership).count() == memberships_count_before


# 13. test_13_nonexistent_membership_returns_404
def test_13_nonexistent_membership_returns_404():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/memberships/99999")
    assert resp.status_code == 404


# 14. test_14_historical_membership_survives_plan_changes
def test_14_historical_membership_survives_plan_changes():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Update plan 1 to price 250000 and duration 90
    resp_up = client.put("/membership-plans/1", json={"price": 250000.00, "duration_days": 90})
    assert resp_up.status_code == 200

    # Membership 1 continues to have price 120000 and 30 days
    resp_mem = client.get("/memberships/1")
    assert resp_mem.status_code == 200
    data = resp_mem.json()
    assert float(data["price"]) == 120000.00
    start_dt = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
    assert (end_dt - start_dt).days == 30


# 15. test_15_new_membership_uses_current_plan_values
def test_15_new_membership_uses_current_plan_values():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create new client 3
    c3 = Client(gym_id=1, full_name="Laura Martinez", document_type="CC", document="3003", phone="3205556677", email="laura@martinez.com", is_active=True)
    db.add(c3)
    db.commit()
    db.refresh(c3)

    # Assign updated plan 1
    resp_create = client.post("/memberships/", json={
        "client_id": c3.id,
        "membership_plan_id": 1
    })
    assert resp_create.status_code == 201
    new_mem_id = resp_create.json()["id"]

    # Query detail of new membership
    resp_detail = client.get(f"/memberships/{new_mem_id}")
    assert resp_detail.status_code == 200
    data = resp_detail.json()
    assert float(data["price"]) == 250000.00
    start_dt = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
    assert (end_dt - start_dt).days == 90
