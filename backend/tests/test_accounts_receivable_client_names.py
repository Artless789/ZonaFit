import pytest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import get_db
from app.core.auth import get_current_user
from app.main import app
from app.models.client import Client
from app.models.gym import Gym
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
        dbapi_connection.create_function(
            "num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None)
        )


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def ar_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=10, name="MerwilFit Primero de Mayo", email="pdm@zonafit.com", is_active=True)
    gym2 = Gym(id=20, name="Gym Beta", email="beta@zonafit.com", is_active=True)
    db.add_all([gym1, gym2])
    db.flush()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=10, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=20, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=10, gym_id=10, full_name="Admin Merwil", email="merwil10@zonafit.com", role="OWNER", password="hash", is_active=True)
    user2 = User(id=20, gym_id=20, full_name="Admin Beta", email="beta20@zonafit.com", role="OWNER", password="hash", is_active=True)
    db.add_all([user1, user2])

    # Clients: Client 280 (like in user screenshot) and Client 283
    c280 = Client(
        id=280,
        gym_id=10,
        full_name="CARLOS ANDRES PEREZ",
        document_type="CC",
        document="1098765432",
        phone="3001234567",
        email="carlos.perez@test.com",
        is_active=True,
    )
    c283 = Client(
        id=283,
        gym_id=10,
        full_name="MARIA JOSE VALENCIA",
        document_type="CC",
        document="1098765999",
        phone="3109876543",
        email="maria.valencia@test.com",
        is_active=True,
    )
    c_beta = Client(
        id=500,
        gym_id=20,
        full_name="CLIENTE BETA",
        document_type="CC",
        document="999888777",
        phone="3200000000",
        is_active=True,
    )
    db.add_all([c280, c283, c_beta])
    db.flush()

    # Sales
    s1 = Sale(id=101, gym_id=10, client_id=280, total=Decimal("65000.00"), status="COMPLETED", is_active=True)
    s2 = Sale(id=102, gym_id=10, client_id=283, total=Decimal("65000.00"), status="COMPLETED", is_active=True)
    s_beta = Sale(id=201, gym_id=20, client_id=500, total=Decimal("50000.00"), status="COMPLETED", is_active=True)
    db.add_all([s1, s2, s_beta])
    db.flush()

    # Accounts Receivable
    ar1 = AccountsReceivable(
        id=101,
        gym_id=10,
        client_id=280,
        sale_id=101,
        original_amount=Decimal("65000.00"),
        paid_amount=Decimal("60000.00"),
        balance_due=Decimal("5000.00"),
        status="PARTIAL",
        is_active=True,
    )
    ar2 = AccountsReceivable(
        id=102,
        gym_id=10,
        client_id=283,
        sale_id=102,
        original_amount=Decimal("65000.00"),
        paid_amount=Decimal("0.00"),
        balance_due=Decimal("65000.00"),
        status="PENDING",
        is_active=True,
    )
    ar_beta = AccountsReceivable(
        id=201,
        gym_id=20,
        client_id=500,
        sale_id=201,
        original_amount=Decimal("50000.00"),
        paid_amount=Decimal("0.00"),
        balance_due=Decimal("50000.00"),
        status="PENDING",
        is_active=True,
    )
    db.add_all([ar1, ar2, ar_beta])
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

    yield {
        "db": db,
        "user1": user1,
        "user2": user2,
        "get_test_db": get_test_db,
    }

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_accounts_receivables_response_contains_client_details(ar_db):
    user1 = ar_db["user1"]
    get_test_db = ar_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user1

    client = TestClient(app)
    try:
        # GET /accounts-receivables/
        resp = client.get("/accounts-receivables/")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) == 2

        # Validate AR for client 280
        ar280_data = next(item for item in data["items"] if item["client_id"] == 280)
        assert ar280_data["client"] is not None
        assert ar280_data["client"]["full_name"] == "CARLOS ANDRES PEREZ"
        assert ar280_data["client"]["document"] == "1098765432"
        assert ar280_data["client"]["phone"] == "3001234567"
        assert ar280_data["client_name"] == "CARLOS ANDRES PEREZ"

        # Validate AR for client 283
        ar283_data = next(item for item in data["items"] if item["client_id"] == 283)
        assert ar283_data["client"] is not None
        assert ar283_data["client"]["full_name"] == "MARIA JOSE VALENCIA"
        assert ar283_data["client_name"] == "MARIA JOSE VALENCIA"

        # GET /accounts-receivables/101 (single)
        resp_single = client.get("/accounts-receivables/101")
        assert resp_single.status_code == 200
        single_data = resp_single.json()
        assert single_data["client"] is not None
        assert single_data["client"]["full_name"] == "CARLOS ANDRES PEREZ"
        assert single_data["client_name"] == "CARLOS ANDRES PEREZ"

        # Test search by client name
        resp_search = client.get("/accounts-receivables/?search=carlos")
        assert resp_search.status_code == 200
        search_data = resp_search.json()
        assert len(search_data["items"]) == 1
        assert search_data["items"][0]["client_id"] == 280

        # Test search by document
        resp_doc = client.get("/accounts-receivables/?search=1098765999")
        assert resp_doc.status_code == 200
        doc_data = resp_doc.json()
        assert len(doc_data["items"]) == 1
        assert doc_data["items"][0]["client_id"] == 283
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_accounts_receivables_multi_tenant_isolation(ar_db):
    user2 = ar_db["user2"]
    get_test_db = ar_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user2

    client = TestClient(app)
    try:
        # User 2 only sees gym 2 receivables
        resp = client.get("/accounts-receivables/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["gym_id"] == 20
        assert data["items"][0]["client_id"] == 500
        assert data["items"][0]["client"]["full_name"] == "CLIENTE BETA"
        assert data["items"][0]["client_name"] == "CLIENTE BETA"

        # User 2 cannot access AR 101 from gym 10
        resp_forbidden = client.get("/accounts-receivables/101")
        assert resp_forbidden.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
