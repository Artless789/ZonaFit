import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_users_p11.db"
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
def setup_users_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym A
    gym_a = Gym(id=1, name="Gimnasio Alpha", email="alpha@gym.com", owner_id=1)
    db.add(gym_a)

    # Gym B
    gym_b = Gym(id=2, name="Gimnasio Beta", email="beta@gym.com", owner_id=4)
    db.add(gym_b)
    db.commit()

    # Subscriptions for Gym A and Gym B
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub_a = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True
    )
    sub_b = Subscription(
        gym_id=2,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True
    )
    db.add_all([sub_a, sub_b])
    db.commit()

    # Users for Gym A
    user_a1 = User(id=1, gym_id=1, full_name="Carlos Alpha", email="carlos@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user_a2 = User(id=2, gym_id=1, full_name="Ana Staff Active", email="ana@alpha.com", password=hash_password("Pass1234"), role="STAFF", is_active=True)
    user_a3 = User(id=3, gym_id=1, full_name="Beto Staff Inactive", email="beto@alpha.com", password=hash_password("Pass1234"), role="STAFF", is_active=False)

    # Users for Gym B
    user_b1 = User(id=4, gym_id=2, full_name="Diana Beta Owner", email="diana@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user_b2 = User(id=5, gym_id=2, full_name="Eduardo Beta Staff", email="eduardo@beta.com", password=hash_password("Pass1234"), role="STAFF", is_active=True)

    # Superadmin
    superadmin = User(id=99, gym_id=None, full_name="Super Admin", email="admin@zonafit.com", password=hash_password("Pass1234"), role="SUPERADMIN", is_active=True)

    db.add_all([user_a1, user_a2, user_a3, user_b1, user_b2, superadmin])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_get_users_without_status():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 3


def test_02_get_users_with_status_active():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/?status=active")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    for item in data["items"]:
        assert item["is_active"] is True


def test_03_get_users_with_status_inactive():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/?status=inactive")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["full_name"] == "Beto Staff Inactive"
    assert data["items"][0]["is_active"] is False


def test_04_get_users_with_status_all():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/?status=all")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3


def test_05_get_users_with_unrecognized_status_does_not_crash():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/?status=some_unknown_value")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3


def test_06_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()
    
    current_test_user = db.query(User).filter(User.id == 4).first()

    response = client.get("/users/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    for item in data["items"]:
        assert item["gym_id"] == 2
        assert "Alpha" not in item["full_name"]


def test_07_search_filter():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/users/?search=carlos")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["email"] == "carlos@alpha.com"


def test_08_sorting():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response_asc = client.get("/users/?sort_by=full_name&sort_desc=false")
    assert response_asc.status_code == 200
    items_asc = response_asc.json()["items"]
    assert items_asc[0]["full_name"] == "Ana Staff Active"

    response_desc = client.get("/users/?sort_by=full_name&sort_desc=true")
    assert response_desc.status_code == 200
    items_desc = response_desc.json()["items"]
    assert items_desc[0]["full_name"] == "Carlos Alpha"


def test_09_pagination_limit_skip():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response_p1 = client.get("/users/?limit=2&skip=0")
    assert response_p1.status_code == 200
    data_p1 = response_p1.json()
    assert len(data_p1["items"]) == 2
    assert data_p1["total"] == 3

    response_p2 = client.get("/users/?limit=2&skip=2")
    assert response_p2.status_code == 200
    data_p2 = response_p2.json()
    assert len(data_p2["items"]) == 1


def test_10_superadmin_access():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 99).first()

    response = client.get("/users/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 6
