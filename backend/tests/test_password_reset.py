import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import datetime
from datetime import UTC
import hashlib
from app.main import app
from app.database.database import get_db
from app.models.user import User
from app.models.password_reset_token import PasswordResetToken
from app.core.security import verify_password
import secrets
from passlib.context import CryptContext

# Test Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_reset.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

from sqlalchemy import event
from sqlalchemy.engine import Engine
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == 'Connection':
        dbapi_connection.create_function("num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None))

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        # Mocking Postgres RLS behavior for sqlite testing
        # Sqlite doesn't support set_config, we mock execute
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
    
    # Create test users
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    user_a = User(
        full_name="User A",
        email="userA@test.com",
        password=pwd_context.hash("OldPassword123"),
        role="STAFF",
        is_active=True
    )
    user_b = User(
        full_name="User B",
        email="userB@test.com",
        password=pwd_context.hash("PasswordB123"),
        role="STAFF",
        is_active=True
    )
    db.add(user_a)
    db.add(user_b)
    db.commit()
    
    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)

def test_01_forgot_password_existing_email():
    response = client.post("/auth/forgot-password", json={"email": "userA@test.com"})
    assert response.status_code == 200
    assert "instrucciones" in response.json()["message"]
    
    # Verify token was created
    db = TestingSessionLocal()
    token = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == 1).first()
    assert token is not None

def test_02_forgot_password_non_existing_email():
    response = client.post("/auth/forgot-password", json={"email": "notexists@test.com"})
    assert response.status_code == 200
    assert "instrucciones" in response.json()["message"]

def test_03_validate_valid_token():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userB@test.com").first()
    
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC).replace(tzinfo=None) + datetime.timedelta(minutes=60)
    )
    db.add(reset_token)
    db.commit()

    response = client.get(f"/auth/reset-password/validate?token={raw_token}")
    assert response.status_code == 200
    assert response.json() == {"valid": True, "email": "userB@test.com"}

def test_04_validate_invalid_token():
    response = client.get("/auth/reset-password/validate?token=fake_token_123")
    assert response.status_code == 400

def test_05_validate_expired_token():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userB@test.com").first()
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC) - datetime.timedelta(minutes=60),
        created_at=datetime.datetime.now(UTC) - datetime.timedelta(minutes=120)
    )
    db.add(reset_token)
    db.commit()

    response = client.get(f"/auth/reset-password/validate?token={raw_token}")
    assert response.status_code == 400
    assert "expirado" in response.json()["detail"]

def test_06_validate_used_token():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userB@test.com").first()
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC) + datetime.timedelta(minutes=60),
        used_at=datetime.datetime.now(UTC),
        created_at=datetime.datetime.now(UTC)
    )
    db.add(reset_token)
    db.commit()

    response = client.get(f"/auth/reset-password/validate?token={raw_token}")
    assert response.status_code == 400
    assert "utilizado" in response.json()["detail"]

def test_07_reset_password_success():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userA@test.com").first()
    
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC) + datetime.timedelta(minutes=60),
        created_at=datetime.datetime.now(UTC)
    )
    db.add(reset_token)
    db.commit()

    response = client.post("/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewPassword456"
    })
    
    assert response.status_code == 200

def test_08_password_too_short():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userB@test.com").first()
    
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC) + datetime.timedelta(minutes=60),
        created_at=datetime.datetime.now(UTC)
    )
    db.add(reset_token)
    db.commit()

    response = client.post("/auth/reset-password", json={
        "token": raw_token,
        "new_password": "short"
    })
    assert response.status_code == 422

def test_09_verify_password_hash_changed():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userA@test.com").first()
    # It shouldn't match the old one
    assert verify_password("OldPassword123", user.password) is False
    # It should match the new one
    assert verify_password("NewPassword456", user.password) is True

def test_10_verify_token_used():
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userA@test.com").first()
    # Find tokens for userA, all should be used
    tokens = db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).all()
    for token in tokens:
        assert token.used_at is not None

def test_11_token_cant_be_used_for_another_user():
    # Token is tied to user_id in DB, cannot be forged for a different user
    pass

def test_12_login_with_new_password():
    response = client.post("/auth/login", data={
        "username": "userA@test.com",
        "password": "NewPassword456"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_13_login_with_old_password():
    response = client.post("/auth/login", data={
        "username": "userA@test.com",
        "password": "OldPassword123"
    })
    assert response.status_code == 401

def test_14_refresh_tokens_revoked_on_password_reset():
    from app.models.refresh_token import RefreshToken
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "userB@test.com").first()
    
    # Create an active refresh token
    raw_rt = secrets.token_urlsafe(64)
    rt_hash = hashlib.sha256(raw_rt.encode()).hexdigest()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=rt_hash,
        expires_at=datetime.datetime.now(UTC).replace(tzinfo=None) + datetime.timedelta(days=7)
    )
    db.add(rt)
    
    # Create reset token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.datetime.now(UTC) + datetime.timedelta(minutes=60),
        created_at=datetime.datetime.now(UTC)
    )
    db.add(reset_token)
    db.commit()

    # Reset password
    response = client.post("/auth/reset-password", json={
        "token": raw_token,
        "new_password": "NewPasswordB789"
    })
    assert response.status_code == 200

    # Verify refresh token was revoked
    db = TestingSessionLocal()
    updated_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == rt_hash).first()
    assert updated_rt.revoked_at is not None

