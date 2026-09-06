import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
import datetime
from datetime import UTC
import hashlib
from app.main import app
from app.database.database import get_db
from app.models.user import User
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.refresh_token import RefreshToken
from app.core.security import hash_password
from passlib.context import CryptContext

# Test Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == 'Connection':  # sqlite3.Connection
        dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    user_owner = User(
        full_name="Owner User",
        email="owner@auth-test.com",
        password=pwd_context.hash("SecurePassword123!"),
        role="OWNER",
        is_active=True
    )
    db.add(user_owner)
    db.flush()

    gym = Gym(
        name="Auth Test Gym",
        email="gym@auth-test.com",
        owner_id=user_owner.id,
        onboarding_completed=False
    )
    db.add(gym)
    db.flush()

    user_owner.gym_id = gym.id

    settings = GymSettings(
        gym_id=gym.id,
        legal_name="Auth Test Gym SAS",
        trade_name="Auth Test Gym",
        tax_id="900123456-1",
        official_phone="+573001234567",
        official_email="gym@auth-test.com",
        physical_address="Calle 100 # 15-20",
        city="Bogotá"
    )
    db.add(settings)
    db.commit()
    
    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)

def test_01_login_success():
    response = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "refresh_token" in response.cookies
    assert len(response.cookies["refresh_token"]) > 30

def test_02_login_invalid_password():
    response = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "incorrectos" in response.json()["detail"]

def test_03_refresh_token_rotation_success():
    # 1. Login to obtain an initial refresh token
    login_res = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    old_refresh_cookie = login_res.cookies.get("refresh_token")
    assert old_refresh_cookie is not None

    # 2. Call /auth/refresh with the cookie
    client.cookies.set("refresh_token", old_refresh_cookie, path="/auth")
    refresh_res = client.post("/auth/refresh")
    assert refresh_res.status_code == 200
    refresh_data = refresh_res.json()
    assert "access_token" in refresh_data
    
    new_refresh_cookie = refresh_res.cookies.get("refresh_token")
    assert new_refresh_cookie is not None
    assert new_refresh_cookie != old_refresh_cookie

    # 3. Verify in DB that old token is marked revoked and has replaced_by set
    db = TestingSessionLocal()
    old_hash = hashlib.sha256(old_refresh_cookie.encode()).hexdigest()
    old_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == old_hash).first()
    assert old_rt is not None
    assert old_rt.revoked_at is not None
    assert old_rt.replaced_by is not None

    # 4. Verify new token is valid in DB
    new_hash = hashlib.sha256(new_refresh_cookie.encode()).hexdigest()
    new_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == new_hash).first()
    assert new_rt is not None
    assert new_rt.revoked_at is None
    assert old_rt.replaced_by == new_hash

def test_04_replay_attack_detection_revokes_token_family():
    # 1. Login to get a fresh refresh token
    login_res = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    first_rt_cookie = login_res.cookies.get("refresh_token")

    # 2. First refresh (legitimate)
    client.cookies.set("refresh_token", first_rt_cookie, path="/")
    refresh_res1 = client.post("/auth/refresh")
    assert refresh_res1.status_code == 200
    second_rt_cookie = refresh_res1.cookies.get("refresh_token")
    assert second_rt_cookie != first_rt_cookie

    # 3. Age the first token beyond the 30-second grace period in DB
    db = TestingSessionLocal()
    first_hash = hashlib.sha256(first_rt_cookie.encode()).hexdigest()
    first_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == first_hash).first()
    assert first_rt is not None
    first_rt.revoked_at = datetime.datetime.now(UTC).replace(tzinfo=None) - datetime.timedelta(seconds=60)
    db.commit()

    # 4. Replay attack outside grace period: send the expired rotated token
    client.cookies.clear()
    client.cookies.set("refresh_token", first_rt_cookie, path="/")
    replay_res = client.post("/auth/refresh")
    
    # 5. Must return 401 with "Refresh token compromised."
    assert replay_res.status_code == 401
    assert replay_res.json()["detail"] == "Refresh token compromised."

    # 6. Verify that the entire family (including second_rt_cookie) was revoked
    db = TestingSessionLocal()
    second_hash = hashlib.sha256(second_rt_cookie.encode()).hexdigest()
    second_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == second_hash).first()
    assert second_rt is not None
    assert second_rt.revoked_at is not None

def test_05_logout_revokes_refresh_token_and_clears_cookie():
    login_res = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    rt_cookie = login_res.cookies.get("refresh_token")

    client.cookies.set("refresh_token", rt_cookie, path="/")
    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200

    # Verify token in DB is revoked
    db = TestingSessionLocal()
    token_hash = hashlib.sha256(rt_cookie.encode()).hexdigest()
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    assert rt is not None
    assert rt.revoked_at is not None

def test_06_grace_period_recovers_concurrent_request():
    # 1. Login to get a fresh refresh token
    login_res = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    first_rt_cookie = login_res.cookies.get("refresh_token")

    # 2. First refresh (legitimate) rotates first -> second
    client.cookies.set("refresh_token", first_rt_cookie, path="/")
    refresh_res1 = client.post("/auth/refresh")
    assert refresh_res1.status_code == 200
    second_rt_cookie = refresh_res1.cookies.get("refresh_token")

    # 3. Simulate rapid concurrent request (e.g. StrictMode or navigation race) within 30s grace period
    client.cookies.clear()
    client.cookies.set("refresh_token", first_rt_cookie, path="/")
    concurrent_res = client.post("/auth/refresh")

    # Must return 200 OK with valid access token without revoking family
    assert concurrent_res.status_code == 200
    data = concurrent_res.json()
    assert "access_token" in data

    # Verify family is NOT revoked in DB
    db = TestingSessionLocal()
    second_hash = hashlib.sha256(second_rt_cookie.encode()).hexdigest()
    second_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == second_hash).first()
    assert second_rt is not None
    assert second_rt.revoked_at is None

def test_07_duplicate_cookie_header_selects_active_token():
    # 1. Login
    login_res = client.post("/auth/login", data={
        "username": "owner@auth-test.com",
        "password": "SecurePassword123!"
    })
    assert login_res.status_code == 200
    active_token = login_res.cookies.get("refresh_token")
    stale_token = "stale_token_value_from_old_path_12345"

    # 2. Send request with duplicate Cookie header (stale second, active first)
    headers = {
        "cookie": f"refresh_token={active_token}; refresh_token={stale_token}"
    }
    res = client.post("/auth/refresh", headers=headers)
    assert res.status_code == 200
    assert "access_token" in res.json()
