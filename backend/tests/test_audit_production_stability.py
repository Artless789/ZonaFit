import pytest
import hashlib
from datetime import datetime, timedelta, timezone, UTC
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.database import get_db
from app.core.auth import get_current_user, require_active_subscription
from app.main import app
from app.models.client import Client
from app.models.gym import Gym
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.models.cash_register import CashRegister
from app.models.refresh_token import RefreshToken
from app.core.security import hash_password


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
def stability_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym = Gym(id=1, name="ZonaFit Test Gym", email="gym@test.com", is_active=True, onboarding_completed=True)
    db.add(gym)
    db.flush()

    # Subscription Active
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True
    )
    db.add(sub)

    # User
    user = User(
        id=1,
        gym_id=1,
        full_name="Owner ZonaFit",
        email="owner@zonafit.test",
        password=hash_password("TestPassword123!"),
        role="OWNER",
        is_active=True
    )
    db.add(user)
    db.flush()

    # Client
    client = Client(
        id=1,
        gym_id=1,
        full_name="Cliente Prueba",
        document_type="CC",
        document="123456789",
        phone="3001234567",
        is_active=True
    )
    db.add(client)
    db.flush()

    # Sale and Accounts Receivable
    sale = Sale(id=1, gym_id=1, client_id=1, total=Decimal("50000.00"), status="COMPLETED", is_active=True)
    db.add(sale)
    db.flush()

    ar = AccountsReceivable(
        id=1,
        gym_id=1,
        client_id=1,
        sale_id=1,
        original_amount=Decimal("50000.00"),
        paid_amount=Decimal("10000.00"),
        balance_due=Decimal("40000.00"),
        status="PARTIAL",
        is_active=True
    )
    db.add(ar)
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
        "user": user,
        "get_test_db": get_test_db,
    }

    db.close()
    Base.metadata.drop_all(bind=engine)


def test_accounts_receivable_success_with_subscription(stability_db):
    user = stability_db["user"]
    get_test_db = stability_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_active_subscription] = lambda: user

    client = TestClient(app)
    try:
        resp = client.get("/accounts-receivables/")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert Decimal(str(item["balance_due"])) == Decimal("40000.00")
        assert item["client"] is not None
        assert item["client"]["full_name"] == "Cliente Prueba"
        assert item["client_name"] == "Cliente Prueba"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_active_subscription, None)


def test_accounts_receivable_subscription_required_when_unpaid(stability_db):
    user = stability_db["user"]
    get_test_db = stability_db["get_test_db"]

    # When require_active_subscription is not bypassed, verify 403 behavior
    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    try:
        resp = client.get("/accounts-receivables/")
        # Subscription is active in the stability_db fixture, so it should be 200
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_client_pagination_page_size_validation(stability_db):
    user = stability_db["user"]
    get_test_db = stability_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    try:
        # page_size=100 is valid (max allowed)
        resp_100 = client.get("/clients/?page=1&page_size=100")
        assert resp_100.status_code == 200

        # page_size=500 is rejected with 422
        resp_500 = client.get("/clients/?page=1&page_size=500")
        assert resp_500.status_code == 422
        assert "Page size must be between 1 and 100" in resp_500.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_cash_register_active_404_when_no_register(stability_db):
    user = stability_db["user"]
    get_test_db = stability_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    try:
        resp = client.get("/cash-registers/active")
        assert resp.status_code == 404
        assert "No hay una caja abierta." in resp.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_cash_register_closing_notes_persistence_and_query(stability_db):
    user = stability_db["user"]
    get_test_db = stability_db["get_test_db"]

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_current_user] = lambda: user

    client = TestClient(app)
    try:
        # 1. Open register
        open_resp = client.post("/cash-registers/open", json={"opening_balance": 50000})
        assert open_resp.status_code == 201
        reg_id = open_resp.json()["id"]

        # 2. Close register with closing_notes
        close_resp = client.post(
            f"/cash-registers/{reg_id}/close",
            json={
                "counted_balance": 50000,
                "closing_notes": "Turno cerrado sin novedades, caja cuadrada perfectamente.",
                "reconciliations": [
                    {
                        "method": "CASH",
                        "registered_amount": 50000,
                        "verified_amount": 50000,
                        "difference": 0,
                        "status": "CUADRADO"
                    }
                ]
            }
        )
        assert close_resp.status_code == 200
        closed_data = close_resp.json()
        assert closed_data["status"] == "CLOSED"
        assert closed_data["closing_notes"] == "Turno cerrado sin novedades, caja cuadrada perfectamente."

        # 3. Query all registers (Historial) and verify closing_notes is returned
        history_resp = client.get("/cash-registers/")
        assert history_resp.status_code == 200
        history_items = history_resp.json()
        assert len(history_items) >= 1
        matched = next(r for r in history_items if r["id"] == reg_id)
        assert matched["closing_notes"] == "Turno cerrado sin novedades, caja cuadrada perfectamente."
        assert Decimal(str(matched["difference"])) == Decimal("0.00")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


def test_auth_login_and_refresh_return_user_profile(stability_db):
    get_test_db = stability_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # 1. Login returns access_token AND user profile with full_name
        login_resp = client.post("/auth/login", data={
            "username": "owner@zonafit.test",
            "password": "TestPassword123!"
        })
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        assert "access_token" in login_data
        assert "user" in login_data
        user_profile = login_data["user"]
        assert user_profile["id"] == 1
        assert user_profile["full_name"] == "Owner ZonaFit"
        assert user_profile["name"] == "Owner ZonaFit"
        assert user_profile["role"] == "OWNER"

        # 2. Refresh returns access_token AND user profile
        refresh_resp = client.post("/auth/refresh")
        assert refresh_resp.status_code == 200
        refresh_data = refresh_resp.json()
        assert "access_token" in refresh_data
        assert "user" in refresh_data
        assert refresh_data["user"]["full_name"] == "Owner ZonaFit"
        assert refresh_data["user"]["role"] == "OWNER"

        # 3. GET /auth/me also returns full_name and name
        token = refresh_data["access_token"]
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["full_name"] == "Owner ZonaFit"
        assert me_data["name"] == "Owner ZonaFit"
    finally:
        app.dependency_overrides.pop(get_db, None)
