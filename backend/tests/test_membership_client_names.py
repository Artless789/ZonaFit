import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.core.auth import get_current_user
from app.main import app
from app.models.client import Client
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.services.membership_service import MembershipService
from app.schemas.filter import FilterParams
from app.schemas.pagination import PaginationParams
from app.schemas.sort import SortParams


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
        dbapi_connection.create_function(
            "num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None)
        )


from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def membership_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="MerwilFit Primero de Mayo", email="primerodemayo@zonafit.com", is_active=True)
    gym2 = Gym(id=2, name="Gym Beta", email="beta@zonafit.com", is_active=True)
    db.add_all([gym1, gym2])
    db.flush()

    # Subscriptions for gyms
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin 1", email="admin1@zonafit.com", role="OWNER", password="hash", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin 2", email="admin2@zonafit.com", role="OWNER", password="hash", is_active=True)
    db.add_all([user1, user2])

    # Clients: Specifically client_id=1 and a high client_id=250
    c1 = Client(id=1, gym_id=1, full_name="FLOR SAMPAYO", document_type="CC", document="1007218223", phone="3122762622", is_active=True)
    c250 = Client(id=250, gym_id=1, full_name="CARLOS GOMEZ", document_type="CC", document="99887766", phone="3119998888", is_active=True)
    c_beta = Client(id=3, gym_id=2, full_name="PEDRO BETA", document_type="CC", document="55443322", phone="3005554433", is_active=True)
    db.add_all([c1, c250, c_beta])

    # Plans
    plan1 = MembershipPlan(id=1, gym_id=1, name="Mensualidad", duration_days=31, price=Decimal("80000.00"), is_active=True)
    plan_beta = MembershipPlan(id=2, gym_id=2, name="Plan Beta", duration_days=30, price=Decimal("70000.00"), is_active=True)
    db.add_all([plan1, plan_beta])
    db.flush()

    # Memberships
    now = datetime.now(timezone.utc)
    m1 = Membership(id=1, gym_id=1, client_id=1, membership_plan_id=1, start_date=now, end_date=now, price=Decimal("80000.00"), status="ACTIVE", is_active=True)
    m2 = Membership(id=2, gym_id=1, client_id=250, membership_plan_id=1, start_date=now, end_date=now, price=Decimal("80000.00"), status="ACTIVE", is_active=True)
    m_beta = Membership(id=3, gym_id=2, client_id=3, membership_plan_id=2, start_date=now, end_date=now, price=Decimal("70000.00"), status="ACTIVE", is_active=True)
    db.add_all([m1, m2, m_beta])
    db.commit()

    def get_test_db():
        s = TestingSessionLocal()
        original_execute = s.execute
        def mock_execute(statement, *args, **kwargs):
            if isinstance(statement, str) and "set_config" in statement.lower():
                return
            if hasattr(statement, 'text') and "set_config" in statement.text.lower():
                return
            return original_execute(statement, *args, **kwargs)
        s.execute = mock_execute
        try:
            yield s
        finally:
            s.close()

    yield {"db": db, "get_test_db": get_test_db, "user1": user1, "user2": user2, "client1": c1, "client250": c250}

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_membership_service_eagerly_loads_client_name_and_plan(membership_db):
    db = membership_db["db"]
    user1 = membership_db["user1"]

    res = MembershipService.get_all(
        db=db,
        current_user=user1,
        filters=FilterParams(),
        sort=SortParams(),
        params=PaginationParams(page=1, page_size=20),
    )

    assert len(res.items) == 2

    # Verificar específicamente membresía con client_id=1
    item_client_1 = next(item for item in res.items if item.client_id == 1)
    assert item_client_1.client is not None
    assert item_client_1.client.full_name == "FLOR SAMPAYO"
    assert item_client_1.client_name == "FLOR SAMPAYO"
    assert item_client_1.membership_plan is not None
    assert item_client_1.membership_plan.name == "Mensualidad"
    assert item_client_1.plan_name == "Mensualidad"

    # Verificar membresía con client_id=250 (cliente que caería fuera del límite de 20 clientes)
    item_client_250 = next(item for item in res.items if item.client_id == 250)
    assert item_client_250.client is not None
    assert item_client_250.client.full_name == "CARLOS GOMEZ"
    assert item_client_250.client_name == "CARLOS GOMEZ"


def test_membership_service_get_by_id_eagerly_loads_client(membership_db):
    db = membership_db["db"]
    user1 = membership_db["user1"]
    user2 = membership_db["user2"]

    # Usuario de gym 1 accede a membresía 1
    m = MembershipService.get_by_id(db, user1, membership_id=1)
    assert m is not None
    assert m.client is not None
    assert m.client.full_name == "FLOR SAMPAYO"
    assert m.client_name == "FLOR SAMPAYO"
    assert m.membership_plan.name == "Mensualidad"
    assert m.plan_name == "Mensualidad"

    # Aislamiento multi-tenant: Usuario de gym 2 no puede acceder a membresía de gym 1
    m_isolated = MembershipService.get_by_id(db, user2, membership_id=1)
    assert m_isolated is None


def test_memberships_api_endpoint_response_contains_client_details(membership_db):
    user1 = membership_db["user1"]
    get_test_db = membership_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user1

    client = TestClient(app)
    try:
        # GET /memberships/
        resp = client.get("/memberships/")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) == 2

        # Validar membresía client_id=1
        m1_data = next(item for item in data["items"] if item["client_id"] == 1)
        assert m1_data["client"] is not None
        assert m1_data["client"]["full_name"] == "FLOR SAMPAYO"
        assert m1_data["client_name"] == "FLOR SAMPAYO"
        assert m1_data["plan_name"] == "Mensualidad"

        # Validar membresía client_id=250
        m250_data = next(item for item in data["items"] if item["client_id"] == 250)
        assert m250_data["client"] is not None
        assert m250_data["client"]["full_name"] == "CARLOS GOMEZ"
        assert m250_data["client_name"] == "CARLOS GOMEZ"

        # GET /memberships/1
        resp_single = client.get("/memberships/1")
        assert resp_single.status_code == 200
        single_data = resp_single.json()
        assert single_data["client"]["full_name"] == "FLOR SAMPAYO"
        assert single_data["client_name"] == "FLOR SAMPAYO"
        assert single_data["plan_name"] == "Mensualidad"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_memberships_multi_tenant_isolation(membership_db):
    user2 = membership_db["user2"]
    get_test_db = membership_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user2

    client = TestClient(app)
    try:
        # User 2 solo ve membresías de gym 2
        resp = client.get("/memberships/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["gym_id"] == 2
        assert data["items"][0]["client"]["full_name"] == "PEDRO BETA"
        assert data["items"][0]["client_name"] == "PEDRO BETA"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
