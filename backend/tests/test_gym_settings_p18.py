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
from app.models.gym_settings import GymSettings
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_gym_settings_p18.db"
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
def setup_gym_settings_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Alpha", email="alpha@gym.com", owner_id=1, onboarding_completed=False)
    gym2 = Gym(id=2, name="Gym Beta", email="beta@gym.com", owner_id=2, onboarding_completed=False)
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
    staff1 = User(id=3, gym_id=1, full_name="Staff Alpha", email="staff@alpha.com", password=hash_password("Pass1234"), role="STAFF", is_active=True)
    db.add_all([user1, user2, staff1])
    db.commit()

    # GymSettings for Gym 1 & Gym 2
    settings1 = GymSettings(
        id=1,
        gym_id=1,
        legal_name="ZonaFit Alpha S.A.S.",
        trade_name="ZonaFit Alpha",
        tax_id="901234567-1",
        tax_regime="Régimen Simplificado",
        official_phone="3001112233",
        official_email="contacto@alpha.com",
        physical_address="Carrera 15 # 85-30",
        city="Valledupar",
        country="Colombia",
        currency="COP",
        timezone="America/Bogota",
        default_tax_percentage=Decimal("19.00"),
        receipt_footer_notes="¡Gracias por entrenar en ZonaFit Alpha!"
    )

    settings2 = GymSettings(
        id=2,
        gym_id=2,
        legal_name="ZonaFit Beta S.A.S.",
        trade_name="ZonaFit Beta",
        tax_id="901987654-2",
        tax_regime="Régimen Común",
        official_phone="3009998877",
        official_email="contacto@beta.com",
        physical_address="Calle 50 # 10-20",
        city="Barranquilla",
        country="Colombia",
        currency="COP",
        timezone="America/Bogota",
        default_tax_percentage=Decimal("19.00"),
        receipt_footer_notes="¡Gracias por entrenar en ZonaFit Beta!"
    )
    db.add_all([settings1, settings2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_get_current_gym_configuration():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    response = client.get("/gym-settings/")
    assert response.status_code == 200
    data = response.json()
    assert data["gym_id"] == 1
    assert data["legal_name"] == "ZonaFit Alpha S.A.S."
    assert data["trade_name"] == "ZonaFit Alpha"
    assert data["city"] == "Valledupar"
    assert float(data["default_tax_percentage"]) == 19.0


def test_02_update_gym_name():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "legal_name": "ZonaFit Alpha Centro S.A.S.",
        "trade_name": "ZonaFit Alpha Centro"
    }
    response = client.put("/gym-settings/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["legal_name"] == "ZonaFit Alpha Centro S.A.S."
    assert data["trade_name"] == "ZonaFit Alpha Centro"


def test_03_update_gym_contact_information():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "official_phone": "3158889900",
        "official_email": "soporte@alphacentro.com"
    }
    response = client.put("/gym-settings/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["official_phone"] == "3158889900"
    assert data["official_email"] == "soporte@alphacentro.com"


def test_04_update_gym_address():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "physical_address": "Avenida 9 # 12-45",
        "city": "Bogota"
    }
    response = client.put("/gym-settings/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["physical_address"] == "Avenida 9 # 12-45"
    assert data["city"] == "Bogota"


def test_05_update_multiple_configuration_fields():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "tax_id": "900111222-3",
        "tax_regime": "Gran Contribuyente",
        "default_tax_percentage": 16.0,
        "receipt_footer_notes": "Visita nuestra web www.zonafit.com"
    }
    response = client.put("/gym-settings/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["tax_id"] == "900111222-3"
    assert data["tax_regime"] == "Gran Contribuyente"
    assert float(data["default_tax_percentage"]) == 16.0
    assert data["receipt_footer_notes"] == "Visita nuestra web www.zonafit.com"


def test_06_update_persists_after_reload():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Query again via GET endpoint
    response = client.get("/gym-settings/")
    assert response.status_code == 200
    data = response.json()
    assert data["legal_name"] == "ZonaFit Alpha Centro S.A.S."
    assert data["trade_name"] == "ZonaFit Alpha Centro"
    assert data["official_phone"] == "3158889900"
    assert data["official_email"] == "soporte@alphacentro.com"
    assert data["physical_address"] == "Avenida 9 # 12-45"
    assert data["city"] == "Bogota"
    assert data["tax_id"] == "900111222-3"
    assert float(data["default_tax_percentage"]) == 16.0


def test_07_partial_update_preserves_other_fields():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Update ONLY city
    response = client.put("/gym-settings/", json={"city": "Medellin"})
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Medellin"
    # Verify other fields are preserved
    assert data["legal_name"] == "ZonaFit Alpha Centro S.A.S."
    assert data["trade_name"] == "ZonaFit Alpha Centro"
    assert data["official_phone"] == "3158889900"
    assert data["official_email"] == "soporte@alphacentro.com"


def test_08_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # GET returns Gym 2 settings, completely isolated from Gym 1
    resp_beta = client.get("/gym-settings/")
    assert resp_beta.status_code == 200
    data_beta = resp_beta.json()
    assert data_beta["gym_id"] == 2
    assert data_beta["legal_name"] == "ZonaFit Beta S.A.S."
    assert data_beta["trade_name"] == "ZonaFit Beta"
    assert data_beta["city"] == "Barranquilla"

    # Update Gym 2 settings
    update_resp = client.put("/gym-settings/", json={"trade_name": "ZonaFit Beta Premium"})
    assert update_resp.status_code == 200
    assert update_resp.json()["trade_name"] == "ZonaFit Beta Premium"

    # Switch back to User 1 (Gym 1) and verify Gym 1 was NOT affected
    current_test_user = db.query(User).filter(User.id == 1).first()
    resp_alpha = client.get("/gym-settings/")
    assert resp_alpha.status_code == 200
    assert resp_alpha.json()["trade_name"] == "ZonaFit Alpha Centro"


def test_09_unauthorized_role_cannot_modify_settings():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to STAFF user (Role STAFF)
    current_test_user = db.query(User).filter(User.id == 3).first()
    assert current_test_user.role == "STAFF"

    # STAFF user should get 403 Forbidden when attempting to update settings
    resp = client.put("/gym-settings/", json={"trade_name": "Hack Name"})
    assert resp.status_code == 403


def test_10_validation_rejects_invalid_tax_percentage_and_currency():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Invalid tax percentage (> 100)
    resp_tax = client.put("/gym-settings/", json={"default_tax_percentage": 150.0})
    assert resp_tax.status_code == 422

    # Invalid currency (not in COP, USD, EUR)
    resp_curr = client.put("/gym-settings/", json={"currency": "XYZ"})
    assert resp_curr.status_code == 422


def test_11_complete_onboarding_updates_gym_state():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Before: onboarding_completed is False
    gym_before = db.query(Gym).filter(Gym.id == 1).first()
    assert gym_before.onboarding_completed is False

    # Call complete-onboarding endpoint
    resp = client.post("/gym-settings/complete-onboarding")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # After: onboarding_completed is True
    db.expire_all()
    gym_after = db.query(Gym).filter(Gym.id == 1).first()
    assert gym_after.onboarding_completed is True
