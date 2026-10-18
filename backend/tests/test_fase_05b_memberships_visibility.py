import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.database import get_db
from app.database.base import Base
from app.core.auth import get_current_user
from app.core.security import hash_password
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.subscription import Subscription, SubscriptionStatus
from app.constants.membership_status import MembershipStatus

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
        dbapi_connection.create_function(
            "num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None)
        )


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

current_test_user = None


def override_get_db():
    try:
        db = TestingSessionLocal()
        original_execute = db.execute

        def mock_execute(statement, *args, **kwargs):
            if isinstance(statement, str) and "set_config" in statement.lower():
                return
            if hasattr(statement, "text") and "set_config" in statement.text.lower():
                return
            return original_execute(statement, *args, **kwargs)

        db.execute = mock_execute
        yield db
    finally:
        db.close()


def override_get_current_user():
    return current_test_user


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    global current_test_user
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    gym1 = Gym(id=1, name="ZonaFit Gym 1", email="gym1@zonafit.com", owner_id=1)
    gym2 = Gym(id=2, name="ZonaFit Gym 2", email="gym2@zonafit.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    now = datetime.now(timezone.utc)
    sub1 = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True,
    )
    sub2 = Subscription(
        gym_id=2,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True,
    )
    db.add_all([sub1, sub2])

    user1 = User(
        id=1,
        gym_id=1,
        full_name="Admin Gym 1",
        email="admin1@zonafit.com",
        password=hash_password("Pass1234"),
        role="ADMIN",
        is_active=True,
    )
    user2 = User(
        id=2,
        gym_id=2,
        full_name="Admin Gym 2",
        email="admin2@zonafit.com",
        password=hash_password("Pass1234"),
        role="ADMIN",
        is_active=True,
    )
    db.add_all([user1, user2])
    db.commit()

    plan1 = MembershipPlan(
        id=1,
        gym_id=1,
        name="Plan Mensual Pro",
        duration_days=30,
        price=Decimal("80000.00"),
        is_active=True,
    )
    plan2 = MembershipPlan(
        id=2,
        gym_id=2,
        name="Plan Gym 2",
        duration_days=30,
        price=Decimal("90000.00"),
        is_active=True,
    )
    db.add_all([plan1, plan2])
    db.commit()

    current_test_user = user1
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield db
    db.close()


def test_scenario_01_active_membership_visibility():
    """1. Socio con membresía activa vigente: aparece 'Vigente' en tabla, get_client y perfil 360."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c1 = Client(
        id=101,
        gym_id=1,
        full_name="Carlos Activo",
        document_type="CC",
        document="1010101",
        phone="3001112233",
        is_active=True,
    )
    db.add(c1)
    db.commit()

    m1 = Membership(
        id=201,
        gym_id=1,
        client_id=101,
        membership_plan_id=1,
        start_date=now - timedelta(days=5),
        end_date=now + timedelta(days=25),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add(m1)
    db.commit()

    # 1.1 List endpoint
    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    items = res_list.json()["items"]
    assert len(items) == 1
    mem = items[0]["current_membership"]
    assert mem is not None
    assert mem["status"] == "ACTIVE"
    assert mem["plan_name"] == "Plan Mensual Pro"
    assert mem["days_left"] > 20
    assert items[0]["has_membership_history"] is True

    # 1.2 Get by ID endpoint
    res_single = client.get("/clients/101")
    assert res_single.status_code == 200
    single_mem = res_single.json()["current_membership"]
    assert single_mem is not None
    assert single_mem["status"] == "ACTIVE"

    # 1.3 Client 360 endpoint
    res_360 = client.get("/clients/101/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    assert data_360["current_membership"] is not None
    assert data_360["current_membership"]["status"] == "ACTIVE"
    assert data_360["has_membership_history"] is True
    assert len(data_360["membership_history"]) == 1
    assert data_360["membership_history"][0]["id"] == 201


def test_scenario_02_expired_membership_visibility():
    """2. Socio con membresía vencida: aparece 'Vencida' con días transcurridos exactos, nunca 'Sin membresía'."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c2 = Client(
        id=102,
        gym_id=1,
        full_name="Lucia Vencida",
        document_type="CC",
        document="1020202",
        phone="3002223344",
        is_active=True,
    )
    db.add(c2)
    db.commit()

    m2 = Membership(
        id=202,
        gym_id=1,
        client_id=102,
        membership_plan_id=1,
        start_date=now - timedelta(days=35),
        end_date=now - timedelta(days=5),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    db.add(m2)
    db.commit()

    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    item = res_list.json()["items"][0]
    mem = item["current_membership"]
    assert mem is not None
    assert mem["status"] == "EXPIRED"
    assert mem["days_left"] == -5
    assert item["has_membership_history"] is True

    res_360 = client.get("/clients/102/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    assert data_360["current_membership"]["status"] == "EXPIRED"
    assert data_360["current_membership"]["days_left"] == -5
    assert data_360["has_membership_history"] is True


def test_scenario_03_future_scheduled_membership():
    """3. Socio con membresía futura programada: aparece 'Programada' con fecha de inicio."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c3 = Client(
        id=103,
        gym_id=1,
        full_name="Fernando Futuro",
        document_type="CC",
        document="1030303",
        phone="3003334455",
        is_active=True,
    )
    db.add(c3)
    db.commit()

    m3 = Membership(
        id=203,
        gym_id=1,
        client_id=103,
        membership_plan_id=1,
        start_date=now + timedelta(days=7),
        end_date=now + timedelta(days=37),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add(m3)
    db.commit()

    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    mem = res_list.json()["items"][0]["current_membership"]
    assert mem is not None
    assert mem["status"] == "FUTURE"
    assert mem["days_left"] == 7

    res_360 = client.get("/clients/103/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    assert data_360["current_membership"]["status"] == "FUTURE"


def test_scenario_04_cancelled_membership_visibility():
    """4. Socio con membresía cancelada: aparece 'CANCELLED' sin confundirse con vencida."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c4 = Client(
        id=104,
        gym_id=1,
        full_name="Marcos Cancelado",
        document_type="CC",
        document="1040404",
        phone="3004445566",
        is_active=True,
    )
    db.add(c4)
    db.commit()

    m4 = Membership(
        id=204,
        gym_id=1,
        client_id=104,
        membership_plan_id=1,
        start_date=now - timedelta(days=10),
        end_date=now + timedelta(days=20),
        price=Decimal("80000.00"),
        status=MembershipStatus.CANCELLED,
        is_active=False,
    )
    db.add(m4)
    db.commit()

    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    item = res_list.json()["items"][0]
    mem = item["current_membership"]
    assert mem is not None
    assert mem["status"] == "CANCELLED"
    assert item["has_membership_history"] is True

    res_360 = client.get("/clients/104/360")
    assert res_360.status_code == 200
    assert res_360.json()["current_membership"]["status"] == "CANCELLED"


def test_scenario_05_client_never_had_membership():
    """5. Socio que nunca ha tenido membresías: aparece None y has_membership_history False."""
    db = TestingSessionLocal()
    c5 = Client(
        id=105,
        gym_id=1,
        full_name="Natalia Nueva",
        document_type="CC",
        document="1050505",
        phone="3005556677",
        is_active=True,
    )
    db.add(c5)
    db.commit()

    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    item = res_list.json()["items"][0]
    assert item["current_membership"] is None
    assert item["has_membership_history"] is False

    res_360 = client.get("/clients/105/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    assert data_360["current_membership"] is None
    assert data_360["has_membership_history"] is False
    assert len(data_360["membership_history"]) == 0


def test_scenario_06_renewal_prioritizes_active_over_expired():
    """6. Socio con renovación: prioriza la membresía activa sobre la vencida anterior."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c6 = Client(
        id=106,
        gym_id=1,
        full_name="Roberto Renovado",
        document_type="CC",
        document="1060606",
        phone="3006667788",
        is_active=True,
    )
    db.add(c6)
    db.commit()

    old_mem = Membership(
        id=205,
        gym_id=1,
        client_id=106,
        membership_plan_id=1,
        start_date=now - timedelta(days=40),
        end_date=now - timedelta(days=10),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    new_mem = Membership(
        id=206,
        gym_id=1,
        client_id=106,
        membership_plan_id=1,
        start_date=now - timedelta(days=9),
        end_date=now + timedelta(days=21),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add_all([old_mem, new_mem])
    db.commit()

    res_list = client.get("/clients/")
    assert res_list.status_code == 200
    curr = res_list.json()["items"][0]["current_membership"]
    assert curr["id"] == 206
    assert curr["status"] == "ACTIVE"

    res_360 = client.get("/clients/106/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    assert data_360["current_membership"]["id"] == 206
    assert data_360["current_membership"]["status"] == "ACTIVE"
    # History contains both in descending start_date order
    assert len(data_360["membership_history"]) == 2
    assert data_360["membership_history"][0]["id"] == 206
    assert data_360["membership_history"][1]["id"] == 205


def test_scenario_07_expired_and_cancelled_prioritizes_expired():
    """7. Socio con membresía vencida y otra cancelada: prioriza la vencida para renovación."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c7 = Client(
        id=107,
        gym_id=1,
        full_name="Sara Mixta",
        document_type="CC",
        document="1070707",
        phone="3007778899",
        is_active=True,
    )
    db.add(c7)
    db.commit()

    cancelled_m = Membership(
        id=207,
        gym_id=1,
        client_id=107,
        membership_plan_id=1,
        start_date=now - timedelta(days=60),
        end_date=now - timedelta(days=40),
        price=Decimal("80000.00"),
        status=MembershipStatus.CANCELLED,
        is_active=False,
    )
    expired_m = Membership(
        id=208,
        gym_id=1,
        client_id=107,
        membership_plan_id=1,
        start_date=now - timedelta(days=35),
        end_date=now - timedelta(days=5),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    db.add_all([cancelled_m, expired_m])
    db.commit()

    res_360 = client.get("/clients/107/360")
    assert res_360.status_code == 200
    data_360 = res_360.json()
    # Priority ensures EXPIRED wins over CANCELLED
    assert data_360["current_membership"]["status"] == "EXPIRED"
    assert data_360["current_membership"]["id"] == 208
    assert len(data_360["membership_history"]) == 2


def test_scenario_08_membership_creation_reflected_immediately():
    """8. Crear membresía actualiza la vista 360 del socio inmediatamente."""
    db = TestingSessionLocal()
    c8 = Client(
        id=108,
        gym_id=1,
        full_name="Diego Inmediato",
        document_type="CC",
        document="1080808",
        phone="3008889900",
        is_active=True,
    )
    db.add(c8)
    db.commit()

    # Before membership: returns None
    res_before = client.get("/clients/108/360")
    assert res_before.status_code == 200
    assert res_before.json()["current_membership"] is None
    assert res_before.json()["has_membership_history"] is False

    # Create membership via API
    now = datetime.now(timezone.utc)
    res_create = client.post(
        "/memberships/",
        json={
            "client_id": 108,
            "membership_plan_id": 1,
            "start_date": now.isoformat(),
            "discount": 0,
            "register_payment": False,
        },
    )
    assert res_create.status_code == 201

    # After creation: Client 360 immediately reflects new membership
    res_after = client.get("/clients/108/360")
    assert res_after.status_code == 200
    data_after = res_after.json()
    assert data_after["current_membership"] is not None
    assert data_after["current_membership"]["status"] == "ACTIVE"
    assert data_after["has_membership_history"] is True
    assert len(data_after["membership_history"]) == 1


def test_scenario_09_deactivating_client_preserves_memberships():
    """9. Desactivar un socio no elimina físicamente sus membresías ni sus relaciones."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)
    c9 = Client(
        id=109,
        gym_id=1,
        full_name="Valeria Preservada",
        document_type="CC",
        document="1090909",
        phone="3009990011",
        is_active=True,
    )
    db.add(c9)
    db.commit()

    m9 = Membership(
        id=209,
        gym_id=1,
        client_id=109,
        membership_plan_id=1,
        start_date=now - timedelta(days=5),
        end_date=now + timedelta(days=25),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add(m9)
    db.commit()

    # Deactivate client via soft delete
    res_del = client.delete("/clients/109")
    assert res_del.status_code == 204

    # Direct DB inspection: client is soft-deleted, membership remains intact
    db_fresh = TestingSessionLocal()
    client_row = db_fresh.query(Client).filter(Client.id == 109).first()
    assert client_row is not None
    assert client_row.is_active is False

    membership_row = db_fresh.query(Membership).filter(Membership.id == 209).first()
    assert membership_row is not None
    assert membership_row.client_id == 109
    assert membership_row.is_active is True
    assert membership_row.status == MembershipStatus.ACTIVE
    db_fresh.close()


def test_scenario_10_multitenant_isolation():
    """10. Aislamiento multi-tenant: membresías de gym 1 nunca se muestran a gym 2."""
    global current_test_user
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    # Client in Gym 1
    c10 = Client(
        id=110,
        gym_id=1,
        full_name="Tenant Uno",
        document_type="CC",
        document="1101101",
        phone="3000001111",
        is_active=True,
    )
    db.add(c10)
    db.commit()

    m10 = Membership(
        id=210,
        gym_id=1,
        client_id=110,
        membership_plan_id=1,
        start_date=now - timedelta(days=5),
        end_date=now + timedelta(days=25),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add(m10)
    db.commit()

    # Switch user to Gym 2 admin
    user2 = db.query(User).filter(User.id == 2).first()
    current_test_user = user2

    # Gym 2 attempts to query /clients/
    res_g2_list = client.get("/clients/")
    assert res_g2_list.status_code == 200
    assert len(res_g2_list.json()["items"]) == 0

    # Gym 2 attempts to view client 110
    res_g2_client = client.get("/clients/110")
    assert res_g2_client.status_code == 404

    # Gym 2 attempts to view client 110 360
    res_g2_360 = client.get("/clients/110/360")
    assert res_g2_360.status_code == 404
