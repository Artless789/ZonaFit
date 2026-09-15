import os
import io
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
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_clients_p23.db"
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
def setup_clients_p23_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
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

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_client_without_photo():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "full_name": "Carlos Gomez",
        "document_type": "CC",
        "document": "1001001",
        "phone": "3001234567",
        "email": "carlos@gmail.com",
        "notes": "Sin antecedentes medicos"
    }

    resp = client.post("/clients/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == 1
    assert data["photo_url"] is None
    assert data["full_name"] == "Carlos Gomez"


def test_02_create_client_with_initial_photo_url():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "full_name": "Laura Perez",
        "document_type": "CC",
        "document": "1001002",
        "phone": "3007654321",
        "email": "laura@gmail.com",
        "photo_url": "https://example.com/avatar.jpg"
    }

    resp = client.post("/clients/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["photo_url"] == "https://example.com/avatar.jpg"


def test_03_upload_client_photo_valid_image():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create dummy 1x1 png image bytes
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB\x82"
    
    files = {"file": ("avatar.png", io.BytesIO(fake_png), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["photo_url"] is not None
    assert data["photo_url"].startswith("/clients/photo/")
    assert data["photo_url"].endswith(".png")

    # Verify file physically exists on disk
    filename = data["photo_url"].split("/")[-1]
    from app.routers.clients import UPLOAD_DIR
    file_path = os.path.join(UPLOAD_DIR, filename)
    assert os.path.exists(file_path)


def test_04_get_client_photo_returns_image_file():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Get client 1 photo_url
    client_resp = client.get("/clients/1")
    photo_url = client_resp.json()["photo_url"]
    filename = photo_url.split("/")[-1]

    # Request photo file
    photo_resp = client.get(f"/clients/photo/{filename}")
    assert photo_resp.status_code == 200
    assert len(photo_resp.content) > 0


def test_05_replace_client_photo_deletes_old_file():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    from app.routers.clients import UPLOAD_DIR
    # Get previous filename
    client_resp = client.get("/clients/1")
    old_filename = client_resp.json()["photo_url"].split("/")[-1]
    old_path = os.path.join(UPLOAD_DIR, old_filename)
    assert os.path.exists(old_path)

    # Upload new JPEG photo
    fake_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"
    files = {"file": ("new_avatar.jpg", io.BytesIO(fake_jpeg), "image/jpeg")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    new_photo_url = resp.json()["photo_url"]
    new_filename = new_photo_url.split("/")[-1]
    new_path = os.path.join(UPLOAD_DIR, new_filename)

    assert new_filename != old_filename
    assert os.path.exists(new_path)
    assert not os.path.exists(old_path)


def test_06_delete_client_photo():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    from app.routers.clients import UPLOAD_DIR
    client_resp = client.get("/clients/1")
    photo_filename = client_resp.json()["photo_url"].split("/")[-1]
    photo_path = os.path.join(UPLOAD_DIR, photo_filename)
    assert os.path.exists(photo_path)

    # Delete photo
    del_resp = client.delete("/clients/1/photo")
    assert del_resp.status_code == 200
    assert del_resp.json()["photo_url"] is None
    assert not os.path.exists(photo_path)


def test_07_upload_invalid_mime_type_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    files = {"file": ("script.exe", io.BytesIO(b"binary executable"), "application/x-msdownload")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 400
    assert "File must be a valid image" in resp.json()["detail"]


def test_08_upload_oversized_file_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 6MB dummy bytes
    huge_data = b"0" * (6 * 1024 * 1024)
    files = {"file": ("huge.jpg", io.BytesIO(huge_data), "image/jpeg")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 400
    assert "File too large" in resp.json()["detail"]


def test_09_multi_tenant_isolation_cannot_upload_or_get_foreign_client_photo():
    global current_test_user
    db = TestingSessionLocal()

    # User 1 uploads photo to Client 1 (Gym 1)
    current_test_user = db.query(User).filter(User.id == 1).first()
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB\x82"
    files = {"file": ("gym1_avatar.png", io.BytesIO(fake_png), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    gym1_photo_filename = resp.json()["photo_url"].split("/")[-1]

    # Switch to User 2 (Gym 2)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # User 2 attempts to upload photo to Client 1 (Gym 1)
    resp_upload_foreign = client.post("/clients/1/photo", files=files)
    assert resp_upload_foreign.status_code == 404

    # User 2 attempts to delete photo of Client 1 (Gym 1)
    resp_delete_foreign = client.delete("/clients/1/photo")
    assert resp_delete_foreign.status_code == 404

    # User 2 attempts to get photo of Gym 1 client
    resp_get_foreign = client.get(f"/clients/photo/{gym1_photo_filename}")
    assert resp_get_foreign.status_code == 404


def test_10_updating_photo_does_not_modify_client_other_fields():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    client_before = db.query(Client).filter(Client.id == 1).first()
    name_before = client_before.full_name
    doc_before = client_before.document
    phone_before = client_before.phone
    email_before = client_before.email

    # Upload new photo
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB\x82"
    files = {"file": ("avatar_preserve.png", io.BytesIO(fake_png), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200

    db.expire_all()
    client_after = db.query(Client).filter(Client.id == 1).first()
    assert client_after.full_name == name_before
    assert client_after.document == doc_before
    assert client_after.phone == phone_before
    assert client_after.email == email_before


def test_11_client_without_photo_360_view():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Delete photo from client 1
    client.delete("/clients/1/photo")

    resp_360 = client.get("/clients/1/360")
    assert resp_360.status_code == 200
    data = resp_360.json()
    assert data["client"]["photo_url"] is None
    assert data["client"]["full_name"] == "Carlos Gomez"


def test_12_path_traversal_in_filename_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/clients/photo/..%2F..%2Fsecret.txt")
    assert resp.status_code in [400, 404]


def test_13_upload_webp_valid_image():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create dummy valid WebP header
    fake_webp = b"RIFF\x1a\x00\x00\x00WEBPVP8 \x0e\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00\x02\x00\x34\x25"
    files = {"file": ("avatar.webp", io.BytesIO(fake_webp), "image/webp")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert data["photo_url"].endswith(".webp")

    # Verify retrieval
    filename = data["photo_url"].split("/")[-1]
    photo_resp = client.get(f"/clients/photo/{filename}")
    assert photo_resp.status_code == 200
    assert photo_resp.headers.get("Cache-Control") == "private, max-age=86400"


def test_14_malicious_executable_masqueraded_as_image_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Masqueraded PE executable with image/jpeg Content-Type
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    files = {"file": ("exploit.jpg", io.BytesIO(fake_exe), "image/jpeg")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 400
    assert "File must be a valid image" in resp.json()["detail"]


def test_15_malicious_filename_sanitized_to_server_uuid():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB\x82"
    # Malicious path in filename
    files = {"file": ("../../../../etc/passwd.png", io.BytesIO(fake_png), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    photo_url = resp.json()["photo_url"]
    filename = photo_url.split("/")[-1]
    
    # Server MUST use a clean UUID hex filename, ignoring user path
    assert ".." not in filename
    assert "/" not in filename
    assert "\\" not in filename
    assert len(filename.split(".")[0]) == 32


def test_16_atomic_replacement_failure_preserves_old_photo():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    from app.routers.clients import UPLOAD_DIR
    client_resp = client.get("/clients/1")
    old_filename = client_resp.json()["photo_url"].split("/")[-1]
    old_path = os.path.join(UPLOAD_DIR, old_filename)
    assert os.path.exists(old_path)

    # Attempt replacement with corrupted/invalid file content
    corrupted_data = b"CorruptedNonImageGarbageData"
    files = {"file": ("bad.jpg", io.BytesIO(corrupted_data), "image/jpeg")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 400

    # Old photo MUST still exist on disk and in DB
    assert os.path.exists(old_path)
    client_after = client.get("/clients/1").json()
    assert client_after["photo_url"].endswith(old_filename)

