import io
import os
import pytest
from datetime import datetime, timedelta, timezone
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
from app.models.client_photo import ClientPhoto
from app.models.gym import Gym
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.core.security import hash_password
from app.routers.clients import UPLOAD_DIR
from app.services.client_photo_service import sync_orphan_disk_photos_to_db


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

# Tiny 1x1 valid PNG file (66 bytes)
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture
def persistence_fixture():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 (Tenant 1)
    gym1 = Gym(id=1, name="Gym Alpha", email="alpha@gym.test", is_active=True, onboarding_completed=True)
    db.add(gym1)

    # Gym 2 (Tenant 2)
    gym2 = Gym(id=2, name="Gym Beta", email="beta@gym.test", is_active=True, onboarding_completed=True)
    db.add(gym2)
    db.flush()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="User Alpha", email="alpha@gym.test", password=hash_password("Pass123!"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="User Beta", email="beta@gym.test", password=hash_password("Pass123!"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.flush()

    # Client in Gym 1
    client1 = Client(
        id=1,
        gym_id=1,
        full_name="Client One",
        document_type="CC",
        document="11111111",
        phone="3001111111",
        is_active=True,
    )
    # Client in Gym 2
    client2 = Client(
        id=2,
        gym_id=2,
        full_name="Client Two",
        document_type="CC",
        document="22222222",
        phone="3002222222",
        is_active=True,
    )
    db.add_all([client1, client2])
    db.commit()

    def get_test_db():
        s = TestingSessionLocal()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[require_active_subscription] = lambda: sub1

    uploaded_files_to_clean = []

    yield {
        "db": db,
        "user1": user1,
        "user2": user2,
        "client1": client1,
        "client2": client2,
        "uploaded_files": uploaded_files_to_clean,
    }

    # Cleanup disk files
    for f in uploaded_files_to_clean:
        if os.path.exists(f):
            try:
                os.remove(f)
            except OSError:
                pass

    app.dependency_overrides.clear()
    db.close()


def test_01_upload_persists_to_disk_and_database(persistence_fixture):
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["photo_url"] is not None
    assert data["photo_url"].startswith("/clients/photo/")

    filename = data["photo_url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    persistence_fixture["uploaded_files"].append(file_path)

    # 1. Verify physical file on disk
    assert os.path.exists(file_path)
    with open(file_path, "rb") as f:
        assert f.read() == TINY_PNG

    # 2. Verify record in PostgreSQL / SQLite client_photos table
    db = persistence_fixture["db"]
    photo_record = db.query(ClientPhoto).filter(ClientPhoto.client_id == 1).first()
    assert photo_record is not None
    assert photo_record.filename == filename
    assert photo_record.gym_id == 1
    assert photo_record.content_type == "image/png"
    assert photo_record.data == TINY_PNG
    assert photo_record.file_size == len(TINY_PNG)

    # 3. Verify GET returns 200 and identical content
    get_resp = client.get(f"/clients/photo/{filename}")
    assert get_resp.status_code == 200
    assert get_resp.content == TINY_PNG


def test_02_redeploy_simulated_container_replacement_self_heals_from_db(persistence_fixture):
    """
    Simulates a container rebuild / redeploy where the container's ephemeral
    disk storage is completely wiped out.
    The GET endpoint must detect the missing disk file, query PostgreSQL client_photos,
    restore the file to the local disk cache, and return HTTP 200 with the exact image bytes.
    """
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    # 1. Upload photo
    files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    photo_url = resp.json()["photo_url"]
    filename = photo_url.split("/")[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    persistence_fixture["uploaded_files"].append(file_path)

    assert os.path.exists(file_path)

    # 2. SIMULATE CONTAINER REPLACEMENT / REDEPLOY: Delete the disk file!
    os.remove(file_path)
    assert not os.path.exists(file_path), "File should be physically missing from disk"

    # 3. Request the photo via GET — it MUST NOT return 404!
    get_resp = client.get(f"/clients/photo/{filename}")
    assert get_resp.status_code == 200, f"Expected 200 from self-healing DB cache, got {get_resp.status_code}"
    assert get_resp.content == TINY_PNG

    # 4. Confirm self-healing restored the file physically to disk cache
    assert os.path.exists(file_path), "Self-healing must have re-created the disk cache file"
    with open(file_path, "rb") as f:
        assert f.read() == TINY_PNG

    # 5. Subsequent request hits the fast-path disk cache
    get_resp2 = client.get(f"/clients/photo/{filename}")
    assert get_resp2.status_code == 200
    assert get_resp2.content == TINY_PNG


def test_03_multi_tenant_isolation_prevents_unauthorized_photo_access(persistence_fixture):
    """
    Verifies that a user from Gym 2 cannot access or view client photos belonging to Gym 1.
    """
    user1 = persistence_fixture["user1"]
    user2 = persistence_fixture["user2"]

    # User 1 uploads photo to Client 1 in Gym 1
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)
    files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    filename = resp.json()["photo_url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    persistence_fixture["uploaded_files"].append(file_path)

    # User 2 (Gym 2) attempts to GET Gym 1 client's photo
    app.dependency_overrides[get_current_user] = lambda: user2
    client_user2 = TestClient(app)
    get_resp = client_user2.get(f"/clients/photo/{filename}")
    assert get_resp.status_code == 404
    assert "Photo not found or unauthorized" in get_resp.text


def test_04_delete_photo_removes_from_disk_and_database(persistence_fixture):
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    filename = resp.json()["photo_url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    persistence_fixture["uploaded_files"].append(file_path)

    # Delete photo
    del_resp = client.delete("/clients/1/photo")
    assert del_resp.status_code == 200
    assert del_resp.json()["photo_url"] is None

    # Verify deleted from DB
    db = persistence_fixture["db"]
    assert db.query(ClientPhoto).filter(ClientPhoto.client_id == 1).first() is None

    # Verify deleted from disk
    assert not os.path.exists(file_path)

    # Subsequent GET returns 404
    get_resp = client.get(f"/clients/photo/{filename}")
    assert get_resp.status_code == 404


def test_05_backfill_orphan_disk_photos_to_database(persistence_fixture):
    """
    Tests the migration/backfill helper for legacy images that were saved
    to disk before the client_photos table was introduced.
    """
    db = persistence_fixture["db"]
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    # Setup legacy client with photo_url and file on disk, but NO client_photos row
    legacy_filename = "11112222333344445555666677778888.png"
    legacy_path = os.path.join(UPLOAD_DIR, legacy_filename)
    persistence_fixture["uploaded_files"].append(legacy_path)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(legacy_path, "wb") as f:
        f.write(TINY_PNG)

    client_record = db.query(Client).filter(Client.id == 1).first()
    client_record.photo_url = f"/clients/photo/{legacy_filename}"
    db.commit()

    # Ensure no ClientPhoto exists yet
    assert db.query(ClientPhoto).filter(ClientPhoto.client_id == 1).first() is None

    # Run backfill service
    summary = sync_orphan_disk_photos_to_db(db)
    assert summary["migrated"] >= 1

    # Verify ClientPhoto now exists in DB with the exact bytes
    backed_up = db.query(ClientPhoto).filter(ClientPhoto.client_id == 1).first()
    assert backed_up is not None
    assert backed_up.filename == legacy_filename
    assert backed_up.data == TINY_PNG

    # Now simulate a redeploy (delete disk file)
    os.remove(legacy_path)
    assert not os.path.exists(legacy_path)

    # GET must succeed and restore the image from DB
    get_resp = client.get(f"/clients/photo/{legacy_filename}")
    assert get_resp.status_code == 200
    assert get_resp.content == TINY_PNG
    assert os.path.exists(legacy_path)


def test_06_security_prevents_path_traversal_and_invalid_filenames(persistence_fixture):
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    # Directory traversal
    assert client.get("/clients/photo/../../etc/passwd").status_code in [400, 404]
    # Non-uuid / script filenames
    assert client.get("/clients/photo/exploit.php").status_code == 400
    assert client.get("/clients/photo/test.sh").status_code == 400


def test_07_corrupted_zero_byte_disk_file_self_heals_from_db(persistence_fixture):
    """
    Case E: If a 0-byte or corrupted file exists in the disk cache, the system
    must not serve empty content; it must fall through to PostgreSQL client_photos,
    overwrite the empty cache file with the real image bytes, and return HTTP 200.
    """
    user1 = persistence_fixture["user1"]
    app.dependency_overrides[get_current_user] = lambda: user1
    client = TestClient(app)

    # 1. Upload photo
    files = {"file": ("avatar.png", io.BytesIO(TINY_PNG), "image/png")}
    resp = client.post("/clients/1/photo", files=files)
    assert resp.status_code == 200
    filename = resp.json()["photo_url"].split("/")[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    persistence_fixture["uploaded_files"].append(file_path)

    # 2. Corrupt the file on disk by truncating to 0 bytes
    with open(file_path, "wb") as f:
        f.write(b"")
    assert os.path.getsize(file_path) == 0

    # 3. GET request must detect 0-byte cache, self-heal from DB, and return valid bytes
    get_resp = client.get(f"/clients/photo/{filename}")
    assert get_resp.status_code == 200
    assert get_resp.content == TINY_PNG
    assert os.path.getsize(file_path) == len(TINY_PNG)

