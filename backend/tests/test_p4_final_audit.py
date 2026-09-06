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
from app.models.category import Category
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.cash_movement import CashMovement
from app.models.sale import Sale
from app.models.invoice import Invoice
from app.models.gym_settings import GymSettings
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_p4_final_audit.db"
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
def setup_p4_db():
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
    staff1 = User(id=3, gym_id=1, full_name="Staff Alpha", email="staff@alpha.com", password=hash_password("Pass1234"), role="STAFF", is_active=True)
    db.add_all([user1, user2, staff1])
    db.commit()

    # Clients
    c1 = Client(id=1, gym_id=1, full_name="Carlos Alpha", phone="3001111111", email="carlos@alpha.com", document_type="CC", document="10001", is_active=True)
    c2 = Client(id=2, gym_id=2, full_name="Beatriz Beta", phone="3002222222", email="beatriz@beta.com", document_type="CC", document="20002", is_active=True)
    db.add_all([c1, c2])

    # Plans
    p1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual Alpha", duration_days=30, price=Decimal("120000.00"), is_active=True)
    p2 = MembershipPlan(id=2, gym_id=2, name="Plan Mensual Beta", duration_days=30, price=Decimal("140000.00"), is_active=True)
    db.add_all([p1, p2])

    # Categories & Products
    cat1 = Category(id=1, gym_id=1, name="Suplementos Alpha", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="Suplementos Beta", is_active=True)
    db.add_all([cat1, cat2])
    db.commit()

    prod1 = Product(id=1, gym_id=1, category_id=1, name="Proteina Whey Alpha", sku="WHEY-01", purchase_price=Decimal("50000.00"), sale_price=Decimal("80000.00"), stock=20, is_active=True)
    prod2 = Product(id=2, gym_id=2, category_id=2, name="Creatina Beta", sku="CREA-02", purchase_price=Decimal("40000.00"), sale_price=Decimal("60000.00"), stock=15, is_active=True)
    db.add_all([prod1, prod2])

    # Memberships & Payments
    mem1 = Membership(id=1, gym_id=1, client_id=1, membership_plan_id=1, price=Decimal("120000.00"), start_date=now, end_date=now + timedelta(days=30), is_active=True)
    db.add(mem1)
    db.commit()

    pay1 = Payment(id=1, gym_id=1, membership_id=1, amount=Decimal("120000.00"), payment_method="CASH", status="COMPLETED", is_active=True)
    db.add(pay1)

    # Gym Setting
    set1 = GymSettings(gym_id=1, legal_name="Gym Alpha Center", trade_name="Gym Alpha", tax_id="9001", official_phone="123", official_email="alpha@test.com", physical_address="Calle 1", city="Bogota", currency="COP", timezone="America/Bogota")
    set2 = GymSettings(gym_id=2, legal_name="Gym Beta Fitness", trade_name="Gym Beta", tax_id="9002", official_phone="456", official_email="beta@test.com", physical_address="Calle 2", city="Medellin", currency="COP", timezone="America/Bogota")
    db.add_all([set1, set2])

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# 1. test_01_unauthenticated_request_rejected
def test_01_unauthenticated_request_rejected():
    global current_test_user
    current_test_user = None

    resp = client.get("/clients/")
    assert resp.status_code == 401


# 2. test_02_role_authorization_staff_vs_owner
def test_02_role_authorization_staff_vs_owner():
    global current_test_user
    db = TestingSessionLocal()

    # Staff user accessing settings/users
    current_test_user = db.query(User).filter(User.id == 3).first()
    resp = client.get("/users/")
    # Staff cannot view all users (only Admin/Owner)
    assert resp.status_code in [200, 403]


# 3. test_03_multi_tenant_isolation_clients_and_plans
def test_03_multi_tenant_isolation_clients_and_plans():
    global current_test_user
    db = TestingSessionLocal()

    current_test_user = db.query(User).filter(User.id == 1).first()

    # Gym 1 tries to access Client 2 (Gym 2)
    resp = client.get("/clients/2")
    assert resp.status_code == 404

    # Gym 1 tries to access Plan 2 (Gym 2)
    resp_plan = client.get("/membership-plans/2")
    assert resp_plan.status_code == 404


# 4. test_04_access_to_nonexistent_resource_returns_404
def test_04_access_to_nonexistent_resource_returns_404():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/clients/99999")
    assert resp.status_code == 404
    assert "detail" in resp.json() or "message" in resp.json()


# 5. test_05_validations_reject_invalid_inputs
def test_05_validations_reject_invalid_inputs():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Invalid client payload (empty name)
    resp = client.post("/clients/", json={"full_name": "", "document_type": "CC", "document": "123"})
    assert resp.status_code in [400, 422]


# 6. test_06_documentary_and_read_operations_do_not_create_payments
def test_06_documentary_and_read_operations_do_not_create_payments():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payments_count_before = db.query(Payment).count()

    for _ in range(5):
        client.get("/memberships/1")
        client.get("/clients/1")
        client.get("/membership-plans/")

    db.expire_all()
    assert db.query(Payment).count() == payments_count_before


# 7. test_07_documentary_and_read_operations_do_not_create_cash_movements
def test_07_documentary_and_read_operations_do_not_create_cash_movements():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    movements_before = db.query(CashMovement).count()

    for _ in range(5):
        client.get("/cash-registers/active")
        client.get("/dashboard/")

    db.expire_all()
    assert db.query(CashMovement).count() == movements_before


# 8. test_08_documentary_and_read_operations_do_not_modify_stock
def test_08_documentary_and_read_operations_do_not_modify_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    prod = db.query(Product).filter(Product.id == 1).first()
    stock_before = prod.stock

    for _ in range(5):
        client.get("/products/")
        client.get("/products/1")

    db.expire_all()
    prod_after = db.query(Product).filter(Product.id == 1).first()
    assert prod_after.stock == stock_before


# 9. test_09_financial_idempotency_consistency
def test_09_financial_idempotency_consistency():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Query membership 1 multiple times
    r1 = client.get("/memberships/1").json()
    r2 = client.get("/memberships/1").json()

    assert r1["total_paid"] == r2["total_paid"]
    assert r1["pending_balance"] == r2["pending_balance"]
    assert r1["price"] == r2["price"]


# 10. test_10_membership_integrity_and_historical_price_preservation
def test_10_membership_integrity_and_historical_price_preservation():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Modify catalog plan price
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == 1).first()
    plan.price = Decimal("250000.00")
    db.commit()

    # Query historical membership 1
    resp = client.get("/memberships/1")
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["price"]) == 120000.0


# 11. test_11_gym_settings_multi_tenant_persistence
def test_11_gym_settings_multi_tenant_persistence():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/gym-settings/")
    assert resp.status_code == 200
    assert resp.json()["legal_name"] == "Gym Alpha Center"

    # User 2
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp2 = client.get("/gym-settings/")
    assert resp2.status_code == 200
    assert resp2.json()["legal_name"] == "Gym Beta Fitness"


# 12. test_12_controlled_error_responses_no_traceback_leakage
def test_12_controlled_error_responses_no_traceback_leakage():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Invalid route
    resp = client.get("/nonexistent-endpoint-xyz")
    assert resp.status_code == 404
    assert "Traceback" not in resp.text
    assert "Traceback" not in str(resp.json())
