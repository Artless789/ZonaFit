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
from app.core.security import hash_password, verify_password
from app.main import app
from app.models.client import Client
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserUpdate
from app.services.email_service import email_service
from app.middleware.rate_limiter import limiter


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
        dbapi_connection.create_function(
            "num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None)
        )
        dbapi_connection.create_function(
            "set_config", -1, lambda *args: None
        )


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def auth_db():
    limiter.enabled = False
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1
    gym1 = Gym(id=1, name="MerwilFit Primero de Mayo", email="primerodemayo@zonafit.com", is_active=True)
    gym2 = Gym(id=2, name="Gym Beta", email="beta@zonafit.com", is_active=True)
    db.add_all([gym1, gym2])
    db.flush()

    # Active subscriptions for gyms
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Pre-existing/Legacy user in Gym 1 stored with mixed-case email directly
    # (simulating un-normalized record prior to migration)
    legacy_user = User(
        id=1,
        gym_id=1,
        full_name="Legacy Owner",
        email="LegacyOwner@ZonaFit.com",
        password=hash_password("SecretPassword123"),
        role="OWNER",
        is_active=True,
    )
    # User 2 in Gym 2
    user2 = User(
        id=2,
        gym_id=2,
        full_name="Beta Owner",
        email="betaowner@zonafit.com",
        password=hash_password("BetaPassword123"),
        role="OWNER",
        is_active=True,
    )
    db.add_all([legacy_user, user2])
    db.commit()

    def get_test_db():
        s = TestingSessionLocal()
        try:
            yield s
        finally:
            s.close()

    yield {
        "db": db,
        "get_test_db": get_test_db,
        "legacy_user": legacy_user,
        "user2": user2,
    }

    db.close()
    Base.metadata.drop_all(bind=engine)
    limiter.enabled = True


def test_01_register_normalizes_email(auth_db):
    """1. Registro con 'Usuario@Gmail.com' almacena 'usuario@gmail.com'."""
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        resp = client.post(
            "/auth/register",
            json={
                "owner_name": "Nuevo Propietario",
                "owner_email": "  NuevoOwner@Gmail.COM  ",
                "owner_password": "SecurePassword123!",
                "gym_name": "Gimnasio Nuevo",
                "gym_phone": "3001234567",
                "gym_address": "Calle 10 # 20-30",
                "gym_city": "Bogota",
            },
        )
        assert resp.status_code == 201

        # Verificar en base de datos que se almacenó en minúsculas y sin espacios
        db = TestingSessionLocal()
        created_user = db.query(User).filter(User.full_name == "Nuevo Propietario").first()
        assert created_user is not None
        assert created_user.email == "nuevoowner@gmail.com"
        db.close()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_02_login_case_insensitivity_and_whitespace(auth_db):
    """
    2. Login con 'usuario@gmail.com' funciona.
    3. Login con 'Usuario@gmail.com' funciona para el mismo usuario.
    4. Login con 'USUARIO@GMAIL.COM' funciona.
    5. Los espacios alrededor del correo se eliminan.
    """
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # Registrar un usuario con email normalizado
        db = TestingSessionLocal()
        u = User(
            id=10,
            gym_id=1,
            full_name="Test User",
            email="testuser@zonafit.com",
            password=hash_password("CaseSensitivePass123"),
            role="STAFF",
            is_active=True,
        )
        db.add(u)
        db.commit()
        db.close()

        # 2. Login con 'testuser@zonafit.com' (exacto)
        resp1 = client.post(
            "/auth/login",
            data={"username": "testuser@zonafit.com", "password": "CaseSensitivePass123"},
        )
        assert resp1.status_code == 200
        assert "access_token" in resp1.json()

        # 3. Login con 'TestUser@ZonaFit.com' (mayúsculas mixtas)
        resp2 = client.post(
            "/auth/login",
            data={"username": "TestUser@ZonaFit.com", "password": "CaseSensitivePass123"},
        )
        assert resp2.status_code == 200
        assert "access_token" in resp2.json()

        # 4. Login con 'TESTUSER@ZONAFIT.COM' (todo mayúsculas)
        resp3 = client.post(
            "/auth/login",
            data={"username": "TESTUSER@ZONAFIT.COM", "password": "CaseSensitivePass123"},
        )
        assert resp3.status_code == 200
        assert "access_token" in resp3.json()

        # 5. Login con '   TestUser@ZonaFit.com   ' (espacios alrededor)
        resp4 = client.post(
            "/auth/login",
            data={"username": "   TestUser@ZonaFit.com   ", "password": "CaseSensitivePass123"},
        )
        assert resp4.status_code == 200
        assert "access_token" in resp4.json()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_03_password_remains_case_sensitive(auth_db):
    """6. La contraseña continúa siendo case-sensitive y no se modifica."""
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # Correct password works
        resp_ok = client.post(
            "/auth/login",
            data={"username": "legacyowner@zonafit.com", "password": "SecretPassword123"},
        )
        assert resp_ok.status_code == 200

        # Password with wrong case fails (401)
        resp_wrong_case = client.post(
            "/auth/login",
            data={"username": "legacyowner@zonafit.com", "password": "secretpassword123"},
        )
        assert resp_wrong_case.status_code == 401
        assert resp_wrong_case.json()["detail"] == "Correo o contraseña incorrectos."

        # Password with UPPERCASE fails (401)
        resp_upper_pass = client.post(
            "/auth/login",
            data={"username": "legacyowner@zonafit.com", "password": "SECRETPASSWORD123"},
        )
        assert resp_upper_pass.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_04_legacy_user_with_uppercase_in_db_can_login(auth_db):
    """
    Compatibilidad: El usuario existente con 'LegacyOwner@ZonaFit.com' en la DB
    puede loguearse con cualquier variante de mayúsculas/minúsculas sin alterar su registro.
    """
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # Login enviando minúsculas contra registro con mayúsculas en DB
        resp1 = client.post(
            "/auth/login",
            data={"username": "legacyowner@zonafit.com", "password": "SecretPassword123"},
        )
        assert resp1.status_code == 200

        # Login enviando mayúsculas
        resp2 = client.post(
            "/auth/login",
            data={"username": "LEGACYOWNER@ZONAFIT.COM", "password": "SecretPassword123"},
        )
        assert resp2.status_code == 200

        # Login con espacios
        resp3 = client.post(
            "/auth/login",
            data={"username": "  LegacyOwner@ZonaFit.com  ", "password": "SecretPassword123"},
        )
        assert resp3.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_05_forgot_password_case_insensitive(auth_db, monkeypatch):
    """7. Recuperación de contraseña funciona independientemente de mayúsculas/minúsculas."""
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    sent_emails = []

    def mock_send_password_reset_email(to_email, reset_url):
        sent_emails.append((to_email, reset_url))

    monkeypatch.setattr(email_service, "send_password_reset_email", mock_send_password_reset_email)

    client = TestClient(app)
    try:
        # Solicitar forgot password con mayúsculas y espacios
        resp = client.post(
            "/auth/forgot-password",
            json={"email": "  LEGACYOWNER@ZONAFIT.COM  "},
        )
        assert resp.status_code == 200
        assert len(sent_emails) == 1
        # El email enviado debe estar normalizado
        assert sent_emails[0][0] == "legacyowner@zonafit.com"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_06_cannot_create_duplicate_user_differing_only_by_case(auth_db):
    """8. No se pueden crear dos usuarios con el mismo email por diferencias de mayúsculas/minúsculas."""
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # Intento 1: Registro vía /auth/register con email existente en mayúsculas
        resp_dup_reg = client.post(
            "/auth/register",
            json={
                "owner_name": "Intento Duplicado",
                "owner_email": "legacyowner@zonafit.com",  # Ya existe como 'LegacyOwner@ZonaFit.com'
                "owner_password": "Password123!",
                "gym_name": "Gimnasio Duplicado",
                "gym_phone": "3000000000",
                "gym_address": "Calle 1",
                "gym_city": "Cali",
            },
        )
        assert resp_dup_reg.status_code == 400
        assert "El correo ya se encuentra registrado" in resp_dup_reg.json()["detail"]

        # Intento 2: Crear usuario mediante UserService con email duplicado en mayúsculas
        db = TestingSessionLocal()
        admin_user = db.query(User).filter(User.id == 1).first()
        with pytest.raises(ValueError, match="El correo electrónico ya está registrado."):
            UserService.create(
                db=db,
                current_user=admin_user,
                user_data=UserCreate(
                    full_name="Otro Usuario",
                    email="LEGACYOWNER@ZONAFIT.COM",
                    password="SomePassword123",
                    role="STAFF",
                ),
            )
        db.close()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_07_user_service_create_and_update_normalizes(auth_db):
    """Prueba que UserService almacena y actualiza emails normalizados."""
    db = TestingSessionLocal()
    admin_user = db.query(User).filter(User.id == 1).first()

    # Crear usuario con email con mayúsculas
    created = UserService.create(
        db=db,
        current_user=admin_user,
        user_data=UserCreate(
            full_name="Staff Test",
            email="  StaffPerson@ZonaFit.COM  ",
            password="StrongPassword123",
            role="STAFF",
        ),
    )
    assert created.email == "staffperson@zonafit.com"

    # Actualizar usuario con nuevo email en mayúsculas
    updated = UserService.update(
        db=db,
        current_user=admin_user,
        user=created,
        user_data=UserUpdate(
            email="  NEW_STAFF_EMAIL@ZonaFit.COM  ",
        ),
    )
    assert updated.email == "new_staff_email@zonafit.com"
    db.close()


def test_08_multitenancy_and_roles_preserved(auth_db):
    """9. Multi-tenancy y roles no se alteran al autenticarse con mayúsculas."""
    get_test_db = auth_db["get_test_db"]
    app.dependency_overrides[get_db] = get_test_db

    client = TestClient(app)
    try:
        # Login de usuario de Gym 1 con mayúsculas
        resp_gym1 = client.post(
            "/auth/login",
            data={"username": "LEGACYOWNER@ZONAFIT.COM", "password": "SecretPassword123"},
        )
        assert resp_gym1.status_code == 200
        token_gym1 = resp_gym1.json()["access_token"]

        # /auth/me con token gym 1
        resp_me1 = client.get("/auth/me", headers={"Authorization": f"Bearer {token_gym1}"})
        assert resp_me1.status_code == 200
        me1 = resp_me1.json()
        assert me1["gym_id"] == 1
        assert me1["role"] == "OWNER"
        assert me1["email"] == "legacyowner@zonafit.com"

        # Login de usuario de Gym 2 con mayúsculas
        resp_gym2 = client.post(
            "/auth/login",
            data={"username": "BETAOWNER@ZONAFIT.COM", "password": "BetaPassword123"},
        )
        assert resp_gym2.status_code == 200
        token_gym2 = resp_gym2.json()["access_token"]

        # /auth/me con token gym 2
        resp_me2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token_gym2}"})
        assert resp_me2.status_code == 200
        me2 = resp_me2.json()
        assert me2["gym_id"] == 2
        assert me2["role"] == "OWNER"
        assert me2["email"] == "betaowner@zonafit.com"
    finally:
        app.dependency_overrides.pop(get_db, None)
