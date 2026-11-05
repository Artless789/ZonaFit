import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
import threading

from app.main import app
from app.database.database import get_db
from app.database.base import Base
from app.core.auth import get_current_user
from app.core.security import hash_password
from app.models.user import User
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.constants.audit_actions import AuditAction
from app.constants.permissions import Role
from app.services.cash_register_service import CashRegisterService
from app.services.cash_scheduler import run_auto_close_sweep


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

current_test_user_id = 1


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


def override_get_current_user(db: Session = Depends(override_get_db)):
    user = db.query(User).filter(User.id == current_test_user_id).first()
    if not user:
        raise ValueError("Test user not found")
    return user


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create Gym 1 (Bogota, UTC-5)
    gym1 = Gym(
        id=1,
        name="ZonaFit Bogota",
        email="bogota@zonafit.test",
        is_active=True,
    )
    db.add(gym1)
    db.flush()

    settings1 = GymSettings(
        gym_id=1,
        legal_name="ZonaFit Bogota SAS",
        trade_name="ZonaFit Bogota",
        tax_id="900123456-1",
        official_phone="3001234567",
        official_email="contacto@zonafit.test",
        physical_address="Cra 15 # 85-30",
        city="Bogota",
        country="Colombia",
        timezone="America/Bogota",
    )
    db.add(settings1)

    # Owner Gym 1
    owner = User(
        id=1,
        gym_id=1,
        email="owner@zonafit.test",
        password=hash_password("Pass123!"),
        full_name="Carlos Dueño",
        role=Role.OWNER,
        is_active=True,
    )
    db.add(owner)

    # Employee Gym 1
    employee = User(
        id=2,
        gym_id=1,
        email="staff@zonafit.test",
        password=hash_password("Pass123!"),
        full_name="Maria Recepcionista",
        role=Role.STAFF,
        is_active=True,
    )
    db.add(employee)

    # Subscription
    sub1 = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        is_lifetime=True,
        starts_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    db.add(sub1)

    # Gym 2 (Santiago, UTC-3 / UTC-4) for timezone tests
    gym2 = Gym(
        id=2,
        name="ZonaFit Santiago",
        email="santiago@zonafit.test",
        is_active=True,
    )
    db.add(gym2)
    db.flush()

    settings2 = GymSettings(
        gym_id=2,
        legal_name="ZonaFit Chile SpA",
        trade_name="ZonaFit Santiago",
        tax_id="76123456-7",
        official_phone="+56912345678",
        official_email="chile@zonafit.test",
        physical_address="Av Providencia 1234",
        city="Santiago",
        country="Chile",
        timezone="America/Santiago",
    )
    db.add(settings2)

    owner2 = User(
        id=3,
        gym_id=2,
        email="chile_owner@zonafit.test",
        password=hash_password("Pass123!"),
        full_name="Patricio Dueño",
        role=Role.OWNER,
        is_active=True,
    )
    db.add(owner2)

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def test_01_cash_register_open_before_midnight_is_auto_closed_at_midnight():
    """
    Test 01: A register opened on Day 1 is automatically closed at 00:00 (Day 2)
    with status=CLOSED, close_type=AUTOMATIC, exact expected balance, and audit trail.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")

    # Day 1: 08:00 AM local time
    day1_local = datetime(2026, 11, 4, 8, 0, 0, tzinfo=bogota_tz)
    day1_utc = day1_local.astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("50000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)

    # Add movements
    m1 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("30000.00"),
        type="IN",
        category="SALE",
        description="Venta efectivo suplemento",
        created_by=2,
        created_at=day1_utc + timedelta(hours=2),
    )
    m2 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("10000.00"),
        type="OUT",
        category="MANUAL_OUT",
        description="Compra de café mostrador",
        created_by=2,
        created_at=day1_utc + timedelta(hours=4),
    )
    db.add_all([m1, m2])
    db.commit()

    # Time moves to Day 2 at 00:00:10 local time
    day2_local = datetime(2026, 11, 5, 0, 0, 10, tzinfo=bogota_tz)
    day2_utc = day2_local.astimezone(timezone.utc)

    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed) == 1
    closed_reg = closed[0]

    assert closed_reg.id == reg.id
    assert closed_reg.status == "CLOSED"
    assert closed_reg.close_type == "AUTOMATIC"
    assert closed_reg.closed_by is None
    # Expected: 50,000 + 30,000 - 10,000 = 70,000
    assert closed_reg.expected_balance == Decimal("70000.00")
    assert closed_reg.counted_balance is None
    assert closed_reg.difference is None
    assert "Cierre" in closed_reg.closing_notes
    assert "autom" in closed_reg.closing_notes.lower()

    # Verify audit log
    audit = db.query(AuditLog).filter(
        AuditLog.gym_id == 1,
        AuditLog.action == AuditAction.CASH_REGISTER_CLOSED,
        AuditLog.entity_id == reg.id
    ).first()
    assert audit is not None
    assert "cierre" in audit.description.lower()
    assert "autom" in audit.description.lower()
    assert "Sistema" in audit.user_name

    db.close()


def test_02_manually_closed_register_before_midnight_not_modified():
    """
    Test 02: A register closed manually before midnight by an employee
    must NOT be re-closed or modified by the midnight scheduler.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")

    day1_local = datetime(2026, 11, 4, 8, 0, 0, tzinfo=bogota_tz)
    day1_utc = day1_local.astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("40000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()

    # Manual close by employee at 22:00 local time
    manual_close_utc = datetime(2026, 11, 4, 22, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    reg.status = "CLOSED"
    reg.close_type = "MANUAL"
    reg.closed_by = 2
    reg.closed_at = manual_close_utc
    reg.expected_balance = Decimal("40000.00")
    reg.counted_balance = Decimal("40000.00")
    reg.difference = Decimal("0.00")
    reg.closing_notes = "Cierre manual por Maria al terminar jornada."
    db.commit()

    # Run midnight scheduler at Day 2 00:05 local
    day2_utc = datetime(2026, 11, 5, 0, 5, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)

    # 0 registers closed
    assert len(closed) == 0

    # Ensure manual close data is 100% preserved
    db.refresh(reg)
    assert reg.status == "CLOSED"
    assert reg.close_type == "MANUAL"
    assert reg.closed_by == 2
    assert reg.counted_balance == Decimal("40000.00")
    assert reg.closing_notes == "Cierre manual por Maria al terminar jornada."

    db.close()


def test_03_cash_register_open_for_multiple_days_closes_properly():
    """
    Test 03: If a gym was closed all week and a register remained open for several days,
    the scheduler closes it cleanly with the closing date set to the midnight of the shift day.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")

    # Opened on Monday 2026-11-02
    monday_local = datetime(2026, 11, 2, 9, 0, 0, tzinfo=bogota_tz)
    monday_utc = monday_local.astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("80000.00"),
        status="OPEN",
        opened_at=monday_utc,
    )
    db.add(reg)
    db.commit()

    # Now it is Friday 2026-11-06 at 10:00 AM
    friday_local = datetime(2026, 11, 6, 10, 0, 0, tzinfo=bogota_tz)
    friday_utc = friday_local.astimezone(timezone.utc)

    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=friday_utc)
    assert len(closed) == 1
    closed_reg = closed[0]

    assert closed_reg.status == "CLOSED"
    assert closed_reg.close_type == "AUTOMATIC"
    assert closed_reg.expected_balance == Decimal("80000.00")

    # Shift closed_at is aligned with the end of Monday (Tuesday 00:00:00 local)
    tuesday_midnight_utc = datetime(2026, 11, 3, 0, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    assert closed_reg.closed_at.replace(tzinfo=None) == tuesday_midnight_utc.replace(tzinfo=None)

    db.close()


def test_04_idempotent_duplicate_scheduler_execution():
    """
    Test 04: Running the scheduler multiple times consecutively produces identical, idempotent results
    without duplicate closures or duplicated audit logs.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")

    day1_utc = datetime(2026, 11, 4, 10, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("60000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()

    day2_utc = datetime(2026, 11, 5, 0, 0, 5, tzinfo=bogota_tz).astimezone(timezone.utc)

    # First execution: closes 1 register
    closed_1 = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_1) == 1

    # Second immediate execution: closes 0 registers
    closed_2 = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_2) == 0

    # Third execution: still 0 registers
    closed_3 = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_3) == 0

    # Only 1 audit log was created
    audit_count = db.query(AuditLog).filter(
        AuditLog.gym_id == 1,
        AuditLog.action == AuditAction.CASH_REGISTER_CLOSED,
        AuditLog.entity_id == reg.id
    ).count()
    assert audit_count == 1

    db.close()


def test_05_concurrent_closing_processes_protection():
    """
    Test 05: Two threads/processes calling close_expired_registers simultaneously.
    Only one executes the closure; no double closure or race condition occurs.
    """
    bogota_tz = ZoneInfo("America/Bogota")
    day1_utc = datetime(2026, 11, 4, 9, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    day2_utc = datetime(2026, 11, 5, 0, 0, 2, tzinfo=bogota_tz).astimezone(timezone.utc)

    db_setup = TestingSessionLocal()
    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("100000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db_setup.add(reg)
    db_setup.commit()
    reg_id = reg.id
    db_setup.close()

    results = []

    def worker_close():
        session = TestingSessionLocal()
        try:
            closed = CashRegisterService.close_expired_registers(session, target_gym_id=1, as_of_time=day2_utc)
            results.append(len(closed))
        finally:
            session.close()

    t1 = threading.Thread(target=worker_close)
    t2 = threading.Thread(target=worker_close)

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # The sum of closed registers across both workers must be exactly 1
    assert sum(results) == 1

    db_verify = TestingSessionLocal()
    verified_reg = db_verify.query(CashRegister).filter(CashRegister.id == reg_id).first()
    assert verified_reg.status == "CLOSED"
    assert verified_reg.close_type == "AUTOMATIC"
    db_verify.close()


def test_06_server_shutdown_recovery_catchup():
    """
    Test 06: Server was turned off at midnight and turned back on in the morning.
    Startup catch-up sweep executes, closing the expired register, enabling a fresh opening today.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")

    yesterday_utc = datetime(2026, 11, 4, 16, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("50000.00"),
        status="OPEN",
        opened_at=yesterday_utc,
    )
    db.add(reg)
    db.commit()

    # Morning boot at 07:15 AM
    morning_utc = datetime(2026, 11, 5, 7, 15, 0, tzinfo=bogota_tz).astimezone(timezone.utc)

    # Just-in-time check when staff checks active register or opens register
    active = CashRegisterService.get_active(db, gym_id=1)
    # The active register from yesterday was closed by JIT self-healing!
    assert active is None

    db.refresh(reg)
    assert reg.status == "CLOSED"
    assert reg.close_type == "AUTOMATIC"

    # Staff can now open today's new register with no conflict
    user = db.query(User).filter(User.id == 2).first()
    from app.schemas.cash_register import CashRegisterCreate
    new_reg = CashRegisterService.open_register(db, user, CashRegisterCreate(opening_balance=Decimal("60000.00")))
    assert new_reg.id != reg.id
    assert new_reg.status == "OPEN"
    assert new_reg.opening_balance == Decimal("60000.00")

    db.close()


def test_07_different_gym_timezones():
    """
    Test 07: Gym 1 in Bogota (UTC-5) vs Gym 2 in Santiago (UTC-3).
    At a given UTC time, midnight has passed in Santiago but NOT in Bogota.
    Santiago's register must close; Bogota's register must remain open.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")
    santiago_tz = ZoneInfo("America/Santiago")

    # Both gyms open at 14:00 on Nov 4 in their respective local timezones
    reg_bogota = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("50000.00"),
        status="OPEN",
        opened_at=datetime(2026, 11, 4, 14, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc),
    )
    reg_santiago = CashRegister(
        gym_id=2,
        opened_by=3,
        opening_balance=Decimal("70000.00"),
        status="OPEN",
        opened_at=datetime(2026, 11, 4, 14, 0, 0, tzinfo=santiago_tz).astimezone(timezone.utc),
    )
    db.add_all([reg_bogota, reg_santiago])
    db.commit()

    # UTC test point: Nov 5 at 03:15:00 UTC
    # In Santiago (UTC-3): 00:15 on Nov 5 -> PAST MIDNIGHT!
    # In Bogota (UTC-5): 22:15 on Nov 4 -> BEFORE MIDNIGHT!
    test_utc = datetime(2026, 11, 5, 3, 15, 0, tzinfo=timezone.utc)

    closed = CashRegisterService.close_expired_registers(db, as_of_time=test_utc)

    # Exactly 1 register closed: Santiago
    closed_ids = [r.id for r in closed]
    assert reg_santiago.id in closed_ids
    assert reg_bogota.id not in closed_ids

    db.refresh(reg_santiago)
    db.refresh(reg_bogota)
    assert reg_santiago.status == "CLOSED"
    assert reg_santiago.close_type == "AUTOMATIC"
    assert reg_bogota.status == "OPEN"

    db.close()


def test_08_reversals_and_refunds_integrity():
    """
    Test 08: Reversals, refunds, and manual movements are accurately computed in expected cash.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")
    day1_utc = datetime(2026, 11, 4, 8, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("100000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()

    # 1. Normal sale payment IN: $50,000
    m1 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("50000.00"),
        type="IN",
        category="SALE",
        created_by=2,
        created_at=day1_utc + timedelta(hours=1),
    )
    # 2. Second sale payment IN: $40,000
    m2 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("40000.00"),
        type="IN",
        category="SALE",
        created_by=2,
        created_at=day1_utc + timedelta(hours=2),
    )
    # 3. Reversal OUT: $40,000 (cancelled sale)
    m3 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("40000.00"),
        type="OUT",
        category="REVERSAL",
        description="Anulación de venta #2",
        created_by=2,
        created_at=day1_utc + timedelta(hours=3),
    )
    # 4. Expense OUT: $15,000
    m4 = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("15000.00"),
        type="OUT",
        category="MANUAL_OUT",
        description="Compra implementos de aseo",
        created_by=2,
        created_at=day1_utc + timedelta(hours=4),
    )
    db.add_all([m1, m2, m3, m4])
    db.commit()

    # Auto close at midnight
    day2_utc = datetime(2026, 11, 5, 0, 0, 5, tzinfo=bogota_tz).astimezone(timezone.utc)
    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed) == 1

    # Expected: 100,000 + 50,000 + 40,000 - 40,000 - 15,000 = 135,000
    assert closed[0].expected_balance == Decimal("135000.00")
    assert closed[0].counted_balance is None
    assert closed[0].difference is None

    db.close()


def test_09_operations_near_midnight_and_post_close_rejection():
    """
    Test 09: Movements registered just before midnight are included.
    Attempting to register movements on a closed register is rejected.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")
    day1_utc = datetime(2026, 11, 4, 18, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("20000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()

    # Movement at 23:58:30 local time
    m_near = CashMovement(
        gym_id=1,
        cash_register_id=reg.id,
        amount=Decimal("15000.00"),
        type="IN",
        category="SALE",
        created_by=2,
        created_at=datetime(2026, 11, 4, 23, 58, 30, tzinfo=bogota_tz).astimezone(timezone.utc),
    )
    db.add(m_near)
    db.commit()

    # Auto-closed at 00:00:02 local time
    day2_utc = datetime(2026, 11, 5, 0, 0, 2, tzinfo=bogota_tz).astimezone(timezone.utc)
    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed) == 1
    assert closed[0].expected_balance == Decimal("35000.00")

    # Attempt to add movement to closed register raises ValueError
    user = db.query(User).filter(User.id == 2).first()
    with pytest.raises(ValueError, match="La caja no está abierta"):
        CashRegisterService.add_movement(
            db=db,
            current_user=user,
            register=reg,
            amount=Decimal("5000.00"),
            type="IN",
            category="SALE"
        )

    db.close()


def test_10_automatic_close_never_invents_counted_balance_or_difference():
    """
    Test 10: Verify strict financial integrity:
    No fake counted balance or fake discrepancy/descuadre is ever invented.
    """
    db = TestingSessionLocal()
    bogota_tz = ZoneInfo("America/Bogota")
    day1_utc = datetime(2026, 11, 4, 9, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)

    reg = CashRegister(
        gym_id=1,
        opened_by=2,
        opening_balance=Decimal("50000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()

    day2_utc = datetime(2026, 11, 5, 0, 0, 1, tzinfo=bogota_tz).astimezone(timezone.utc)
    closed = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed) == 1

    db.refresh(reg)
    # Direct DB column validation
    assert reg.expected_balance == Decimal("50000.00")
    assert reg.counted_balance is None
    assert reg.difference is None
    assert reg.close_type == "AUTOMATIC"
    assert "SIN_ARQUEO_FISICO" in reg.reconciliation_data

    # API Endpoint check: GET /cash-registers/ returns correct close_type and null counted_balance
    global current_test_user_id
    current_test_user_id = 1  # Owner
    resp = client.get("/cash-registers/")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) >= 1
    first_item = next(i for i in items if i["id"] == reg.id)
    assert first_item["status"] == "CLOSED"
    assert first_item["close_type"] == "AUTOMATIC"
    assert first_item["counted_balance"] is None
    assert first_item["difference"] is None
    assert Decimal(str(first_item["expected_balance"])) == Decimal("50000.00")

    db.close()
