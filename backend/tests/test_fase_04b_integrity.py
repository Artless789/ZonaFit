import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
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
from app.models.payment import Payment
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
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

    # Plan de membresía
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

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    db.close()


def test_01_expiring_queue_shows_expired_memberships_with_negative_days_left():
    """Membresía vencida visible en dashboard queue con days_left negativo (no clamped a 0)."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    c1 = Client(
        id=10,
        gym_id=1,
        full_name="Carlos Vencido",
        document_type="CC",
        document="11111",
        phone="3110000001",
        photo_url="https://example.com/carlos.jpg",
        is_active=True,
    )
    db.add(c1)
    db.commit()

    # Membresía que venció hace 5 días
    mem_expired = Membership(
        id=101,
        gym_id=1,
        client_id=10,
        membership_plan_id=1,
        start_date=now - timedelta(days=35),
        end_date=now - timedelta(days=5),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    db.add(mem_expired)
    db.commit()
    db.close()

    res = client.get("/dashboard/")
    assert res.status_code == 200
    data = res.json()

    expiring = data.get("expiring_memberships", [])
    assert len(expiring) >= 1
    found = next((m for m in expiring if m["id"] == 101), None)
    assert found is not None
    # days_left must be negative (around -5), NOT clamped to 0!
    assert found["days_left"] < 0
    assert found["client_name"] == "Carlos Vencido"
    assert found["client_document"] == "11111"
    assert found["client_photo_url"] == "https://example.com/carlos.jpg"
    assert found["plan_name"] == "Plan Mensual Pro"
    assert float(found["price"]) == 80000.0


def test_02_renewed_client_excluded_from_expired_list_and_queue():
    """Cliente que renovó (tiene membresía activa futura) queda excluido de la lista de vencidas y de la cola."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    c2 = Client(
        id=20,
        gym_id=1,
        full_name="Renata Renovada",
        document_type="CC",
        document="22222",
        phone="3110000002",
        is_active=True,
    )
    db.add(c2)
    db.commit()

    # Antigua membresía vencida hace 3 días
    old_mem = Membership(
        id=201,
        gym_id=1,
        client_id=20,
        membership_plan_id=1,
        start_date=now - timedelta(days=33),
        end_date=now - timedelta(days=3),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    # Nueva membresía activa (renovación) que vence en 27 días
    new_mem = Membership(
        id=202,
        gym_id=1,
        client_id=20,
        membership_plan_id=1,
        start_date=now - timedelta(days=3),
        end_date=now + timedelta(days=27),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )
    db.add_all([old_mem, new_mem])
    db.commit()
    db.close()

    # Verificar en /memberships/expired
    res_exp = client.get("/memberships/expired")
    assert res_exp.status_code == 200
    expired_data = res_exp.json()
    items = expired_data.get("items", []) if isinstance(expired_data, dict) else expired_data
    # Client 20 should NOT be in expired list
    assert not any(m["client_id"] == 20 for m in items)

    # Verificar en /dashboard/ expiring_memberships queue
    res_dash = client.get("/dashboard/")
    assert res_dash.status_code == 200
    dash_expiring = res_dash.json().get("expiring_memberships", [])
    # Neither old_mem (201) nor new_mem (202) should be in expiring queue
    assert not any(m["client_id"] == 20 for m in dash_expiring)


def test_03_multiple_memberships_deduplication_and_active_exclusion():
    """Cliente con múltiples membresías vencidas muestra solo la más reciente; con membresía activa se excluye."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    # Cliente 30: 2 membresías vencidas, ninguna activa
    c3 = Client(
        id=30,
        gym_id=1,
        full_name="Dario Deduplicado",
        document_type="CC",
        document="33333",
        phone="3110000003",
        is_active=True,
    )
    # Cliente 31: 2 membresías vencidas + 1 membresía activa
    c4 = Client(
        id=31,
        gym_id=1,
        full_name="Marcos Multimembresia",
        document_type="CC",
        document="44444",
        phone="3110000004",
        is_active=True,
    )
    db.add_all([c3, c4])
    db.commit()

    # Membresías de Dario (vencida hace 45 días y vencida hace 4 días)
    dario_m1 = Membership(
        id=301,
        gym_id=1,
        client_id=30,
        membership_plan_id=1,
        start_date=now - timedelta(days=75),
        end_date=now - timedelta(days=45),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    dario_m2 = Membership(
        id=302,
        gym_id=1,
        client_id=30,
        membership_plan_id=1,
        start_date=now - timedelta(days=34),
        end_date=now - timedelta(days=4),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )

    # Membresías de Marcos (vencida antigua, vencida reciente, activa futura)
    marcos_m1 = Membership(
        id=311,
        gym_id=1,
        client_id=31,
        membership_plan_id=1,
        start_date=now - timedelta(days=60),
        end_date=now - timedelta(days=30),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    marcos_m2 = Membership(
        id=312,
        gym_id=1,
        client_id=31,
        membership_plan_id=1,
        start_date=now - timedelta(days=30),
        end_date=now - timedelta(days=1),
        price=Decimal("80000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    marcos_active = Membership(
        id=313,
        gym_id=1,
        client_id=31,
        membership_plan_id=1,
        start_date=now,
        end_date=now + timedelta(days=30),
        price=Decimal("80000.00"),
        status=MembershipStatus.ACTIVE,
        is_active=True,
    )

    db.add_all([dario_m1, dario_m2, marcos_m1, marcos_m2, marcos_active])
    db.commit()
    db.close()

    # En /memberships/expired:
    res = client.get("/memberships/expired")
    assert res.status_code == 200
    data = res.json()
    items = data["items"] if isinstance(data, dict) and "items" in data else data

    # Dario aparece exactamente una vez con su membresía más reciente (id 302, no 301)
    dario_items = [m for m in items if m["client_id"] == 30]
    assert len(dario_items) == 1
    assert dario_items[0]["id"] == 302
    assert dario_items[0]["days_expired"] >= 3

    # Marcos NO aparece porque tiene una membresía activa
    marcos_items = [m for m in items if m["client_id"] == 31]
    assert len(marcos_items) == 0


def test_04_daily_revenue_trend_sums_payments_and_fills_empty_days():
    """El gráfico de tendencia de 30 días suma pagos reales (membresías, pos, cartera) y rellena días vacíos con 0."""
    db = TestingSessionLocal()
    tz_bogota = ZoneInfo("America/Bogota")
    now_local = datetime.now(tz_bogota)
    today_start = datetime.combine(now_local.date(), datetime.min.time(), tzinfo=tz_bogota)

    # Pago de membresía hace 8 días
    p_mem = Payment(
        id=501,
        gym_id=1,
        membership_id=101,
        amount=Decimal("50000.00"),
        payment_method="CASH",
        status="PAID",
        is_active=True,
        created_at=today_start - timedelta(days=8) + timedelta(hours=10),
    )
    # Pago POS hace 8 días
    p_pos = Payment(
        id=502,
        gym_id=1,
        sale_id=102,
        amount=Decimal("12000.00"),
        payment_method="TRANSFER",
        status="PAID",
        is_active=True,
        created_at=today_start - timedelta(days=8) + timedelta(hours=14),
    )
    # Pago Cartera hace 2 días
    p_cartera = Payment(
        id=503,
        gym_id=1,
        accounts_receivable_id=103,
        amount=Decimal("25000.00"),
        payment_method="CARD",
        status="PAID",
        is_active=True,
        created_at=today_start - timedelta(days=2) + timedelta(hours=11),
    )
    # Pago cancelado hace 2 días (no debe sumarse)
    p_cancelled = Payment(
        id=504,
        gym_id=1,
        sale_id=104,
        amount=Decimal("99000.00"),
        payment_method="CASH",
        status="CANCELLED",
        is_active=True,
        created_at=today_start - timedelta(days=2) + timedelta(hours=12),
    )

    db.add_all([p_mem, p_pos, p_cartera, p_cancelled])
    db.commit()
    db.close()

    res = client.get("/dashboard/")
    assert res.status_code == 200
    data = res.json()

    trend = data.get("daily_revenue_trend", [])
    assert len(trend) == 30, f"Expected 30 days in trend, got {len(trend)}"

    # Verificar día hace 8 días
    target_date_8 = (now_local.date() - timedelta(days=8)).strftime("%Y-%m-%d")
    day_8_data = next((d for d in trend if d["date"] == target_date_8), None)
    assert day_8_data is not None
    assert float(day_8_data["amount"]) == 62000.0
    assert float(day_8_data["membership_amount"]) == 50000.0
    assert float(day_8_data["pos_amount"]) == 12000.0
    assert float(day_8_data["receivable_amount"]) == 0.0
    assert day_8_data["transaction_count"] == 2
    assert day_8_data["day_label"] is not None

    # Verificar día hace 2 días
    target_date_2 = (now_local.date() - timedelta(days=2)).strftime("%Y-%m-%d")
    day_2_data = next((d for d in trend if d["date"] == target_date_2), None)
    assert day_2_data is not None
    assert float(day_2_data["amount"]) == 25000.0
    assert float(day_2_data["membership_amount"]) == 0.0
    assert float(day_2_data["pos_amount"]) == 0.0
    assert float(day_2_data["receivable_amount"]) == 25000.0
    assert day_2_data["transaction_count"] == 1

    # Verificar día vacío (ej. hace 5 días)
    target_date_5 = (now_local.date() - timedelta(days=5)).strftime("%Y-%m-%d")
    day_5_data = next((d for d in trend if d["date"] == target_date_5), None)
    assert day_5_data is not None
    assert float(day_5_data["amount"]) == 0.0
    assert float(day_5_data["membership_amount"]) == 0.0
    assert float(day_5_data["pos_amount"]) == 0.0
    assert float(day_5_data["receivable_amount"]) == 0.0
    assert day_5_data["transaction_count"] == 0


def test_05_client_metrics_endpoint():
    """El endpoint /clients/metrics reporta cuentas totales, activas, inactivas, membresías activas y vencidas sin solapamiento."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    # Cliente 1: Activo con membresía activa
    c1 = Client(id=51, gym_id=1, full_name="C1 Activo Activo", document_type="CC", document="5001", phone="3110000051", is_active=True)
    # Cliente 2: Activo con membresía vencida
    c2 = Client(id=52, gym_id=1, full_name="C2 Activo Vencido", document_type="CC", document="5002", phone="3110000052", is_active=True)
    # Cliente 3: Cuenta inactiva
    c3 = Client(id=53, gym_id=1, full_name="C3 Inactivo", document_type="CC", document="5003", phone="3110000053", is_active=False)
    # Cliente 4: Activo con membresía vencida Y membresía activa (renovado)
    c4 = Client(id=54, gym_id=1, full_name="C4 Activo Renovado", document_type="CC", document="5004", phone="3110000054", is_active=True)
    db.add_all([c1, c2, c3, c4])
    db.commit()

    # Membresías
    m1 = Membership(
        id=601, gym_id=1, client_id=51, membership_plan_id=1,
        start_date=now - timedelta(days=5), end_date=now + timedelta(days=25),
        price=Decimal("80000.00"), status=MembershipStatus.ACTIVE, is_active=True
    )
    m2 = Membership(
        id=602, gym_id=1, client_id=52, membership_plan_id=1,
        start_date=now - timedelta(days=35), end_date=now - timedelta(days=5),
        price=Decimal("80000.00"), status=MembershipStatus.EXPIRED, is_active=True
    )
    m4_old = Membership(
        id=603, gym_id=1, client_id=54, membership_plan_id=1,
        start_date=now - timedelta(days=40), end_date=now - timedelta(days=10),
        price=Decimal("80000.00"), status=MembershipStatus.EXPIRED, is_active=True
    )
    m4_new = Membership(
        id=604, gym_id=1, client_id=54, membership_plan_id=1,
        start_date=now - timedelta(days=1), end_date=now + timedelta(days=29),
        price=Decimal("80000.00"), status=MembershipStatus.ACTIVE, is_active=True
    )
    db.add_all([m1, m2, m4_old, m4_new])
    db.commit()
    db.close()

    res = client.get("/clients/metrics")
    assert res.status_code == 200
    metrics = res.json()

    assert metrics["total_clients"] == 4
    assert metrics["active_accounts"] == 3
    assert metrics["inactive_accounts"] == 1
    # Clientes con membresía activa: c1 (51) y c4 (54) -> 2
    assert metrics["active_memberships"] == 2
    # Clientes con membresía vencida excluyendo los que tienen activa: c2 (52) -> 1 (c4 no cuenta como vencido)
    assert metrics["expired_memberships"] == 1

    # En el dashboard, active_membership_clients debe coincidir
    dash_res = client.get("/dashboard/")
    assert dash_res.status_code == 200
    assert dash_res.json()["active_membership_clients"] == 2


def test_06_filter_expired_membership_in_clients_list():
    """El filtro filter_type=expired_membership en /clients/ excluye clientes con renovación activa."""
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    # Cliente 51: Activo con membresía activa
    c1 = Client(id=51, gym_id=1, full_name="C1 Activo Activo", document_type="CC", document="5001", phone="3110000051", is_active=True)
    # Cliente 52: Activo con membresía vencida
    c2 = Client(id=52, gym_id=1, full_name="C2 Activo Vencido", document_type="CC", document="5002", phone="3110000052", is_active=True)
    # Cliente 54: Activo con membresía vencida Y membresía activa (renovado)
    c4 = Client(id=54, gym_id=1, full_name="C4 Activo Renovado", document_type="CC", document="5004", phone="3110000054", is_active=True)
    db.add_all([c1, c2, c4])
    db.commit()

    m1 = Membership(
        id=601, gym_id=1, client_id=51, membership_plan_id=1,
        start_date=now - timedelta(days=5), end_date=now + timedelta(days=25),
        price=Decimal("80000.00"), status=MembershipStatus.ACTIVE, is_active=True
    )
    m2 = Membership(
        id=602, gym_id=1, client_id=52, membership_plan_id=1,
        start_date=now - timedelta(days=35), end_date=now - timedelta(days=5),
        price=Decimal("80000.00"), status=MembershipStatus.EXPIRED, is_active=True
    )
    m4_old = Membership(
        id=603, gym_id=1, client_id=54, membership_plan_id=1,
        start_date=now - timedelta(days=40), end_date=now - timedelta(days=10),
        price=Decimal("80000.00"), status=MembershipStatus.EXPIRED, is_active=True
    )
    m4_new = Membership(
        id=604, gym_id=1, client_id=54, membership_plan_id=1,
        start_date=now - timedelta(days=1), end_date=now + timedelta(days=29),
        price=Decimal("80000.00"), status=MembershipStatus.ACTIVE, is_active=True
    )
    db.add_all([m1, m2, m4_old, m4_new])
    db.commit()
    db.close()

    res = client.get("/clients/?filter_type=expired_membership")
    assert res.status_code == 200
    data = res.json()
    items = data.get("items", [])
    ids = [c["id"] for c in items]

    # c2 (52) debe estar
    assert 52 in ids
    # c4 (54) no debe estar porque renovó
    assert 54 not in ids
    # c1 (51) no debe estar porque está activa
    assert 51 not in ids


def test_07_multi_tenant_isolation():
    """Aislamiento multi-inquilino entre Gym 1 y Gym 2."""
    global current_test_user
    db = TestingSessionLocal()
    now = datetime.now(timezone.utc)

    # Cliente en Gym 2 con membresía vencida
    c_gym2 = Client(
        id=99,
        gym_id=2,
        full_name="Cliente Gym Dos",
        document_type="CC",
        document="99999",
        phone="3220000099",
        is_active=True,
    )
    db.add(c_gym2)
    db.commit()

    m_gym2 = Membership(
        id=901,
        gym_id=2,
        client_id=99,
        membership_plan_id=2,
        start_date=now - timedelta(days=35),
        end_date=now - timedelta(days=5),
        price=Decimal("90000.00"),
        status=MembershipStatus.EXPIRED,
        is_active=True,
    )
    db.add(m_gym2)
    db.commit()

    # Usuario de Gym 1 consulta /memberships/expired
    user1 = db.query(User).filter(User.id == 1).first()
    current_test_user = user1
    res1 = client.get("/memberships/expired")
    assert res1.status_code == 200
    items1 = res1.json()["items"]
    assert not any(m["client_id"] == 99 for m in items1)

    # Usuario de Gym 2 consulta /memberships/expired
    user2 = db.query(User).filter(User.id == 2).first()
    current_test_user = user2
    res2 = client.get("/memberships/expired")
    assert res2.status_code == 200
    items2 = res2.json()["items"]
    assert any(m["client_id"] == 99 for m in items2)
    assert not any(m["client_id"] == 52 for m in items2)

    # Métricas de Gym 2
    res2_metrics = client.get("/clients/metrics")
    assert res2_metrics.status_code == 200
    assert res2_metrics.json()["total_clients"] == 1
    assert res2_metrics.json()["expired_memberships"] == 1
    assert res2_metrics.json()["active_memberships"] == 0

    db.close()
