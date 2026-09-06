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

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_membership_catalog_p26.db"
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
def setup_p26_db():
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


# 1. test_01_get_membership_plans_catalog
def test_01_get_membership_plans_catalog():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create 2 plans for Gym 1
    p1 = MembershipPlan(gym_id=1, name="Plan Mensual", description="Acceso estándar", duration_days=30, price=Decimal("100000.00"), is_active=True)
    p2 = MembershipPlan(gym_id=1, name="Plan Anual", description="Acceso total 365 días", duration_days=365, price=Decimal("900000.00"), is_active=True)
    db.add_all([p1, p2])
    db.commit()

    resp = client.get("/membership-plans/")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) >= 2
    names = [p["name"] for p in data["items"]]
    assert "Plan Mensual" in names
    assert "Plan Anual" in names


# 2. test_02_create_membership_plan
def test_02_create_membership_plan():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Trimestral Pro",
        "description": "3 meses de acceso completo",
        "duration_days": 90,
        "price": 270000.00
    }
    resp = client.post("/membership-plans/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Plan Trimestral Pro"
    assert data["duration_days"] == 90
    assert float(data["price"]) == 270000.00
    assert data["gym_id"] == 1
    assert data["is_active"] is True


# 3. test_03_update_membership_plan
def test_03_update_membership_plan():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Plan Trimestral Pro VIP",
        "price": 285000.00,
        "duration_days": 95
    }
    resp = client.put("/membership-plans/3", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Plan Trimestral Pro VIP"
    assert float(data["price"]) == 285000.00
    assert data["duration_days"] == 95


# 4. test_04_plan_contains_name_price_duration_and_description
def test_04_plan_contains_name_price_duration_and_description():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/membership-plans/3")
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "name" in data and data["name"] == "Plan Trimestral Pro VIP"
    assert "description" in data and data["description"] == "3 meses de acceso completo"
    assert "duration_days" in data and data["duration_days"] == 95
    assert "price" in data and float(data["price"]) == 285000.00
    assert "is_active" in data and data["is_active"] is True
    assert "created_at" in data
    assert "updated_at" in data


# 5. test_05_invalid_price_is_rejected
def test_05_invalid_price_is_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Reject negative price on create
    resp_create = client.post("/membership-plans/", json={
        "name": "Plan Precio Invalido",
        "duration_days": 30,
        "price": -50000.00
    })
    assert resp_create.status_code in [400, 422]

    # Reject negative price on update
    resp_update = client.put("/membership-plans/1", json={"price": -10000.00})
    assert resp_update.status_code in [400, 422]


# 6. test_06_invalid_duration_is_rejected
def test_06_invalid_duration_is_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Zero duration
    resp_zero = client.post("/membership-plans/", json={
        "name": "Plan Cero",
        "duration_days": 0,
        "price": 50000.00
    })
    assert resp_zero.status_code in [400, 422]

    # Negative duration
    resp_neg = client.post("/membership-plans/", json={
        "name": "Plan Negativo",
        "duration_days": -7,
        "price": 50000.00
    })
    assert resp_neg.status_code in [400, 422]

    # Update to zero
    resp_up_zero = client.put("/membership-plans/1", json={"duration_days": 0})
    assert resp_up_zero.status_code in [400, 422]


# 7. test_07_multi_tenant_catalog_isolation
def test_07_multi_tenant_catalog_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 2 creates their own plan
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp_beta = client.post("/membership-plans/", json={
        "name": "Plan Crossfit Beta",
        "duration_days": 30,
        "price": 150000.00
    })
    assert resp_beta.status_code == 201
    beta_plan_id = resp_beta.json()["id"]

    # Gym 2 catalog only contains Gym 2 plans
    resp_beta_list = client.get("/membership-plans/")
    assert resp_beta_list.status_code == 200
    for p in resp_beta_list.json()["items"]:
        assert p["gym_id"] == 2

    # Switch back to Gym 1 user
    current_test_user = db.query(User).filter(User.id == 1).first()
    resp_alpha_list = client.get("/membership-plans/")
    assert resp_alpha_list.status_code == 200
    for p in resp_alpha_list.json()["items"]:
        assert p["gym_id"] == 1
        assert p["id"] != beta_plan_id


# 8. test_08_foreign_plan_cannot_be_updated_or_deleted
def test_08_foreign_plan_cannot_be_updated_or_deleted():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 2 user attempts to update/delete Gym 1 plan (id=1)
    current_test_user = db.query(User).filter(User.id == 2).first()

    resp_up = client.put("/membership-plans/1", json={"name": "Hacked Plan"})
    assert resp_up.status_code == 404

    resp_del = client.delete("/membership-plans/1")
    assert resp_del.status_code == 404


# 9. test_09_membership_can_use_catalog_plan
def test_09_membership_can_use_catalog_plan():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1
    })
    assert resp.status_code == 201
    mem_data = resp.json()
    assert mem_data["membership_plan_id"] == 1
    assert float(mem_data["price"]) == 100000.00
    assert mem_data["status"] == "ACTIVE"


# 10. test_10_updating_plan_does_not_modify_existing_membership
def test_10_updating_plan_does_not_modify_existing_membership():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Get existing membership created in test_09
    mem_before = db.query(Membership).filter(Membership.client_id == 1).first()
    original_price = mem_before.price
    original_end_date = mem_before.end_date

    # Update plan 1 price from 100000 to 160000 and duration from 30 to 45
    resp = client.put("/membership-plans/1", json={
        "price": 160000.00,
        "duration_days": 45
    })
    assert resp.status_code == 200

    # Ensure existing membership in DB did NOT change
    db.expire_all()
    mem_after = db.query(Membership).filter(Membership.client_id == 1).first()
    assert mem_after.price == original_price
    assert mem_after.end_date == original_end_date


# 11. test_11_new_membership_uses_current_plan_values
def test_11_new_membership_uses_current_plan_values():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create client 3
    c3 = Client(gym_id=1, full_name="Laura Restrepo", document_type="CC", document="3003", phone="3201112233", email="laura@restrepo.com", is_active=True)
    db.add(c3)
    db.commit()
    db.refresh(c3)

    # Assign updated plan 1 (price=160000, duration=45)
    resp = client.post("/memberships/", json={
        "client_id": c3.id,
        "membership_plan_id": 1
    })
    assert resp.status_code == 201
    mem_data = resp.json()
    assert float(mem_data["price"]) == 160000.00

    start_dt = datetime.fromisoformat(mem_data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(mem_data["end_date"].replace("Z", "+00:00"))
    assert (end_dt - start_dt).days == 45


# 12. test_12_plan_management_does_not_create_financial_movements
def test_12_plan_management_does_not_create_financial_movements():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Count financial records before
    payments_count_before = db.query(Payment).count()
    cash_movements_count_before = db.query(CashMovement).count()
    sales_count_before = db.query(Sale).count()
    invoices_count_before = db.query(Invoice).count()

    # 1. Create a plan
    resp_c = client.post("/membership-plans/", json={
        "name": "Plan Admin Test",
        "duration_days": 15,
        "price": 50000.00
    })
    assert resp_c.status_code == 201
    new_plan_id = resp_c.json()["id"]

    # 2. Update the plan
    resp_u = client.put(f"/membership-plans/{new_plan_id}", json={
        "price": 55000.00
    })
    assert resp_u.status_code == 200

    # 3. Soft delete (deactivate) the plan
    resp_d = client.delete(f"/membership-plans/{new_plan_id}")
    assert resp_d.status_code == 204

    # Count financial records after
    payments_count_after = db.query(Payment).count()
    cash_movements_count_after = db.query(CashMovement).count()
    sales_count_after = db.query(Sale).count()
    invoices_count_after = db.query(Invoice).count()

    # Must be exactly unchanged
    assert payments_count_after == payments_count_before
    assert cash_movements_count_after == cash_movements_count_before
    assert sales_count_after == sales_count_before
    assert invoices_count_after == invoices_count_before
