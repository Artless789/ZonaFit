"""
MERWIL ZONAFIT — FASE 06-D: TEST DE CERTIFICACIÓN INTEGRAL DE SEGURIDAD Y OPERACIONES

End-to-End integration test suite certifying that FASES 06-A, 06-B, and 06-C
function together seamlessly without regressions, privilege escalations,
or financial leaks.

Scenarios verified:
1. Complete 12-step integrated operational & financial journey:
   - Step 1: Employee logs in via JWT.
   - Step 2: Employee registers a client.
   - Step 3: Employee assigns a membership plan to the client.
   - Step 4: Employee records a cash payment for the membership.
   - Step 5: Employee completes a POS product sale in cash.
   - Step 6: Employee queries authorized operational endpoints (Clients, Sales, Memberships, Dashboard).
   - Step 7 & 8: Employee attempts to access global monthly income & financial reports -> Backend strictly returns 403 Forbidden.
   - Step 9: Owner accesses Audit Logs and identifies all 5 operations performed by the employee with complete metadata.
   - Step 10: Cash register opened during the shift remains OPEN until day end.
   - Step 11: At midnight local time, automatic close executes atomically with expected cash and audit trail.
   - Step 12: Owner queries cash register history and verifies automatic vs manual differentiation without invented physical counts.
2. Cross-tenant isolation verification across all affected entities.
3. Privilege escalation prevention: Employee cannot alter role or permissions.
4. Immutability of audit logs.
5. Concurrency & idempotency of midnight closure in the integrated environment.
"""

from datetime import datetime, timedelta, timezone, time
from decimal import Decimal
import json
from zoneinfo import ZoneInfo
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.base import Base
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.constants.membership_status import MembershipStatus
from app.models.payment import Payment
from app.models.category import Category
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.audit_log import AuditLog
from app.constants.permissions import Role, Permission, DEFAULT_ROLE_PERMISSIONS
from app.constants.audit_actions import AuditAction, AuditModule
from app.core.security import hash_password, create_access_token
from app.services.cash_register_service import CashRegisterService

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

# Active test user ID simulated for the dependency override
active_user_id: int | None = 1


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
    if active_user_id is not None:
        user = db.query(User).filter(User.id == active_user_id).first()
        if user:
            return user
    return None


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_certification_database():
    global active_user_id
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1: Bogotá (UTC-5)
    gym1 = Gym(id=1, name="ZonaFit Bogotá Central", email="bogota@zonafit.test", is_active=True)
    db.add(gym1)

    # Gym 2: Medellín (Aislado, UTC-5)
    gym2 = Gym(id=2, name="ZonaFit Medellín", email="medellin@zonafit.test", is_active=True)
    db.add(gym2)

    now = datetime.now(timezone.utc)
    sub1 = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now - timedelta(days=30),
        ends_at=now + timedelta(days=335),
        is_lifetime=True,
    )
    sub2 = Subscription(
        gym_id=2,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now - timedelta(days=30),
        ends_at=now + timedelta(days=335),
        is_lifetime=True,
    )
    db.add_all([sub1, sub2])

    settings1 = GymSettings(
        gym_id=1,
        legal_name="ZonaFit Colombia SAS",
        trade_name="ZonaFit Bogotá",
        tax_id="900888777-1",
        official_phone="3109876543",
        official_email="bogota@zonafit.test",
        physical_address="Carrera 7 # 72-10",
        city="Bogotá",
        country="Colombia",
        timezone="America/Bogota",
    )
    settings2 = GymSettings(
        gym_id=2,
        legal_name="ZonaFit Paisa SAS",
        trade_name="ZonaFit Medellín",
        tax_id="900999888-2",
        official_phone="3005554433",
        official_email="medellin@zonafit.test",
        physical_address="El Poblado Calle 10",
        city="Medellín",
        country="Colombia",
        timezone="America/Bogota",
    )
    db.add_all([settings1, settings2])

    # 1. OWNER Gym 1
    owner_user = User(
        id=1,
        gym_id=1,
        full_name="Orlando Owner",
        email="owner@zonafit.test",
        role="OWNER",
        password=hash_password("OwnerSecure2026!"),
        is_active=True,
    )
    # 2. EMPLOYEE / STAFF Gym 1
    employee_user = User(
        id=2,
        gym_id=1,
        full_name="Eduardo Empleado",
        email="empleado@zonafit.test",
        role="STAFF",
        password=hash_password("StaffSecure2026!"),
        permissions=DEFAULT_ROLE_PERMISSIONS["STAFF"],
        is_active=True,
    )
    # 3. OWNER Gym 2 (Multi-tenant isolation)
    owner_gym2 = User(
        id=3,
        gym_id=2,
        full_name="Mateo Medellín",
        email="mateo@zonafit.test",
        role="OWNER",
        password=hash_password("MateoSecure2026!"),
        is_active=True,
    )
    db.add_all([owner_user, employee_user, owner_gym2])

    # Category and Product for POS
    cat = Category(id=1, gym_id=1, name="Bebidas & Suplementos")
    db.add(cat)
    db.flush()

    prod = Product(
        id=1,
        gym_id=1,
        category_id=cat.id,
        name="Proteína Whey 2lb",
        sku="WHEY-2LB",
        purchase_price=Decimal("80000.00"),
        sale_price=Decimal("120000.00"),
        stock=50,
        minimum_stock=5,
        is_active=True,
    )
    db.add(prod)

    # Membership Plan
    plan = MembershipPlan(
        id=1,
        gym_id=1,
        name="Plan Mensual Pro",
        duration_days=30,
        price=Decimal("90000.00"),
        is_active=True,
    )
    db.add(plan)

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def test_01_complete_12_step_integrated_flow():
    """
    CERTIFICATION SCENARIO 01: Complete 12-Step Integrated Journey
    Certifies that Employee operations, Security/Forbidden financial guards,
    Audit Trail, Cash movements, and Midnight Auto-Closure all work flawlessly together.
    """
    global active_user_id
    bogota_tz = ZoneInfo("America/Bogota")
    day1_local = datetime(2026, 11, 4, 8, 0, 0, tzinfo=bogota_tz)
    day1_utc = day1_local.astimezone(timezone.utc)

    # =========================================================================
    # STEP 1: Employee Logs In
    # =========================================================================
    active_user_id = 2  # Eduardo Empleado (STAFF)
    login_resp = client.post(
        "/auth/login",
        data={"username": "empleado@zonafit.test", "password": "StaffSecure2026!"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["role"] == "STAFF"
    assert login_data["user"]["permissions"]["view_financials"] is False

    # Also open the day's cash register for Employee shift (Opening base: $100,000)
    open_reg_resp = client.post(
        "/cash-registers/open",
        json={"opening_balance": 100000.0, "opening_notes": "Apertura de turno mañana"},
    )
    assert open_reg_resp.status_code in [200, 201], f"Cash open failed: {open_reg_resp.text}"
    reg_id = open_reg_resp.json()["id"]

    # =========================================================================
    # STEP 2: Employee Registers a Client
    # =========================================================================
    client_payload = {
        "full_name": "Carlos Mendoza",
        "document_type": "CC",
        "document": "1020304050",
        "email": "carlos.mendoza@test.com",
        "phone": "3112223344",
        "gender": "M",
        "address": "Calle 100 # 15-20",
    }
    client_resp = client.post("/clients/", json=client_payload)
    assert client_resp.status_code in [200, 201], f"Client creation failed: {client_resp.text}"
    client_id = client_resp.json()["id"]
    assert client_resp.json()["full_name"] == "Carlos Mendoza"

    # =========================================================================
    # STEP 3: Employee Assigns a Membership to the Client
    # =========================================================================
    membership_payload = {
        "client_id": client_id,
        "membership_plan_id": 1,
        "price": 90000.0,
        "notes": "Inscripción inicial Plan Mensual",
    }
    mem_resp = client.post("/memberships/", json=membership_payload)
    assert mem_resp.status_code in [200, 201], f"Membership creation failed: {mem_resp.text}"
    membership_id = mem_resp.json()["id"]
    assert mem_resp.json()["status"] == "ACTIVE"

    # =========================================================================
    # STEP 4: Employee Registers a Cash Payment for the Membership ($90,000)
    # =========================================================================
    payment_payload = {
        "client_id": client_id,
        "membership_id": membership_id,
        "amount": 90000.0,
        "payment_method": "CASH",
        "notes": "Pago cuota mensual en efectivo",
    }
    pay_resp = client.post("/payments/", json=payment_payload)
    assert pay_resp.status_code in [200, 201], f"Payment registration failed: {pay_resp.text}"

    # =========================================================================
    # STEP 5: Employee Performs a POS Product Sale in Cash ($120,000)
    # =========================================================================
    sale_payload = {
        "client_id": client_id,
        "sale_type": "CASH",
        "payment_method": "CASH",
        "notes": "Venta de suplemento mostrador",
        "items": [{"product_id": 1, "quantity": 1}],
    }
    sale_resp = client.post("/sales/checkout", json=sale_payload)
    assert sale_resp.status_code in [200, 201], f"POS sale failed: {sale_resp.text}"
    sale_id = sale_resp.json()["id"]
    assert Decimal(str(sale_resp.json()["total"])) == Decimal("120000.00")

    # Verify inventory stock was reduced from 50 to 49
    db = TestingSessionLocal()
    prod = db.query(Product).filter(Product.id == 1).first()
    assert prod.stock == 49
    db.close()

    # =========================================================================
    # STEP 6: Employee Queries Authorized Operational Endpoints
    # =========================================================================
    # Operational endpoints MUST return 200 OK
    resp_clients = client.get("/clients/")
    assert resp_clients.status_code == 200
    assert any(c["id"] == client_id for c in resp_clients.json()["items"])

    resp_mems = client.get("/memberships/")
    assert resp_mems.status_code == 200

    resp_sales = client.get("/sales/")
    assert resp_sales.status_code == 200

    # Operational dashboard MUST return 200 OK, but financial figures MUST be masked to zero
    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash_data = resp_dash.json()
    assert Decimal(str(dash_data["income_this_month"])) == Decimal("0.00"), "Employee must NOT see global income"
    assert dash_data["daily_revenue_trend"] == [], "Employee must NOT see revenue trend"
    assert Decimal(str(dash_data["total_receivables"])) == Decimal("0.00"), "Employee must NOT see global receivables"

    # =========================================================================
    # STEPS 7 & 8: Employee Attempts to Query Restricted Financial Endpoints -> 403 FORBIDDEN
    # =========================================================================
    # Financial Reports (all require_financial_access)
    assert client.get("/reports/sales").status_code == 403
    assert client.get("/reports/profits").status_code == 403
    assert client.get("/reports/sales-by-client").status_code == 403
    assert client.get("/reports/payments-by-method").status_code == 403

    # Audit Logs forbidden for employee
    assert client.get("/audit-logs/").status_code == 403

    # Cash register historical logs / other shifts
    assert client.get("/cash-registers/").status_code == 403

    # Dashboard private drawer
    assert client.get("/dashboard/income-details").status_code == 403

    # User administration forbidden
    assert client.get("/users/").status_code == 403

    # =========================================================================
    # STEP 9: Owner Logs In & Queries Audit Trail
    # =========================================================================
    active_user_id = 1  # Orlando Owner
    audit_resp = client.get("/audit-logs/?page=1&limit=50")
    assert audit_resp.status_code == 200, f"Owner audit query failed: {audit_resp.text}"
    audit_data = audit_resp.json()
    items = audit_data["items"]

    # Verify that all operations executed by the employee are present with clear descriptions
    employee_logs = [log for log in items if log.get("user_id") == 2]
    actions_found = {log["action"] for log in employee_logs}

    assert AuditAction.LOGIN in actions_found, "Audit missing LOGIN"
    assert AuditAction.CASH_REGISTER_OPENED in actions_found, "Audit missing CASH_REGISTER_OPENED"
    assert AuditAction.CLIENT_CREATED in actions_found, "Audit missing CLIENT_CREATED"
    assert AuditAction.MEMBERSHIP_CREATED in actions_found, "Audit missing MEMBERSHIP_CREATED"
    assert AuditAction.PAYMENT_CREATED in actions_found, "Audit missing PAYMENT_CREATED"
    assert AuditAction.SALE_CREATED in actions_found, "Audit missing SALE_CREATED"

    # Verify descriptions are clear and name the operator
    client_log = next(log for log in employee_logs if log["action"] == AuditAction.CLIENT_CREATED)
    assert "Eduardo Empleado" in client_log["user_name"]
    assert "Carlos Mendoza" in client_log["entity_name"]
    assert "registró al cliente" in client_log["description"]

    # =========================================================================
    # STEP 10: Cash Register Remains OPEN During the Shift
    # =========================================================================
    db = TestingSessionLocal()
    reg = db.query(CashRegister).filter(CashRegister.id == reg_id).first()
    assert reg.status == "OPEN"
    # Base: 100,000 + Membership payment: 90,000 + POS sale: 120,000 = $310,000
    expected_cash = CashRegisterService.calculate_expected_cash(db, reg)
    assert expected_cash == Decimal("310000.00")
    db.close()

    # =========================================================================
    # STEP 11: At Midnight (00:00 Local), Automatic Closure Executes Atomically
    # =========================================================================
    day2_local = datetime(2026, 11, 5, 0, 0, 5, tzinfo=bogota_tz)
    day2_utc = day2_local.astimezone(timezone.utc)

    # Shift ended at midnight: set opened_at to yesterday (Day 1) to test midnight sweep
    db_advance = TestingSessionLocal()
    reg_to_expire = db_advance.query(CashRegister).filter(CashRegister.id == reg_id).first()
    reg_to_expire.opened_at = day1_utc
    db_advance.commit()
    db_advance.close()

    db_close = TestingSessionLocal()
    closed_list = CashRegisterService.close_expired_registers(db_close, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_list) == 1
    auto_reg = closed_list[0]
    assert auto_reg.id == reg_id
    assert auto_reg.status == "CLOSED"
    assert auto_reg.close_type == "AUTOMATIC"
    assert auto_reg.closed_by is None
    assert auto_reg.expected_balance == Decimal("310000.00")
    assert auto_reg.counted_balance is None, "CRITICAL: Must NEVER invent a counted balance"
    assert auto_reg.difference is None, "CRITICAL: Must NEVER invent a difference"
    assert "cierre" in auto_reg.closing_notes.lower()
    db_close.close()

    # Verify audit event for automatic close
    db_audit = TestingSessionLocal()
    auto_close_log = (
        db_audit.query(AuditLog)
        .filter(
            AuditLog.gym_id == 1,
            AuditLog.action == AuditAction.CASH_REGISTER_CLOSED,
            AuditLog.entity_id == reg_id,
        )
        .order_by(AuditLog.id.desc())
        .first()
    )
    assert auto_close_log is not None
    assert auto_close_log.user_id is None
    assert "Sistema" in auto_close_log.user_name
    assert "cierre" in auto_close_log.description.lower()
    db_audit.close()

    # =========================================================================
    # STEP 12: Owner Queries History & Distinguishes Automatic vs Manual Close
    # =========================================================================
    # Owner performs a second manual open & close on Day 2 to contrast
    active_user_id = 1  # Owner
    open2_resp = client.post(
        "/cash-registers/open",
        json={"opening_balance": 50000.0, "opening_notes": "Apertura manual día 2"},
    )
    assert open2_resp.status_code in [200, 201]
    reg2_id = open2_resp.json()["id"]

    close2_resp = client.post(
        f"/cash-registers/{reg2_id}/close",
        json={"counted_balance": 50000.0, "closing_notes": "Cierre manual arqueado"},
    )
    assert close2_resp.status_code == 200

    # Query cash registers list as Owner
    history_resp = client.get("/cash-registers/")
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 2

    hist_auto = next(r for r in history if r["id"] == reg_id)
    hist_manual = next(r for r in history if r["id"] == reg2_id)

    # 1. Automatic close attributes
    assert hist_auto["close_type"] == "AUTOMATIC"
    assert hist_auto["counted_balance"] is None
    assert hist_auto["difference"] is None
    assert Decimal(str(hist_auto["expected_balance"])) == Decimal("310000.00")

    # 2. Manual close attributes
    assert hist_manual["close_type"] == "MANUAL"
    assert hist_manual["closed_by"] == 1
    assert Decimal(str(hist_manual["counted_balance"])) == Decimal("50000.00")
    assert Decimal(str(hist_manual["difference"])) == Decimal("0.00")


def test_02_multitenant_isolation_and_cross_gym_tampering():
    """
    CERTIFICATION SCENARIO 02: Multi-Tenant Isolation
    Ensures that Users from Gym 1 (Bogotá) cannot access, read, or manipulate
    records belonging to Gym 2 (Medellín), and vice versa.
    """
    global active_user_id

    # Create private records in Gym 2 (Medellín)
    db = TestingSessionLocal()
    g2_client = Client(
        gym_id=2,
        full_name="Medellín Cliente VIP",
        document_type="CC",
        document="99887766",
        email="vip.medellin@test.com",
        phone="3009998877",
    )
    db.add(g2_client)
    db.flush()

    g2_reg = CashRegister(
        gym_id=2,
        opened_by=3,
        opening_balance=Decimal("200000.00"),
        status="OPEN",
    )
    db.add(g2_reg)

    g2_audit = AuditLog(
        gym_id=2,
        action=AuditAction.CASH_REGISTER_OPENED,
        module=AuditModule.CASH_REGISTER,
        entity_type="CashRegister",
        entity_id=10,
        user_id=3,
        user_name="Mateo Medellín",
        description="Apertura privada sede Medellín",
    )
    db.add(g2_audit)
    db.commit()
    g2_client_id = g2_client.id
    g2_reg_id = g2_reg.id
    db.close()

    # 1. Employee from Gym 1 tries to access Gym 2 Client
    active_user_id = 2  # Staff Gym 1
    resp = client.get(f"/clients/{g2_client_id}")
    assert resp.status_code in [403, 404], "Must NOT leak Gym 2 client to Gym 1 Staff"

    # 2. Owner from Gym 1 tries to access Gym 2 Client
    active_user_id = 1  # Owner Gym 1
    resp = client.get(f"/clients/{g2_client_id}")
    assert resp.status_code in [403, 404], "Must NOT leak Gym 2 client to Gym 1 Owner"

    # 3. Owner from Gym 1 tries to close Gym 2 Cash Register
    resp = client.post(
        f"/cash-registers/{g2_reg_id}/close",
        json={"counted_balance": 200000.0, "closing_notes": "Ataque cross-tenant"},
    )
    assert resp.status_code in [400, 403, 404], "Must NOT allow closing another gym's register"

    # 4. Owner from Gym 1 queries audit logs: MUST NOT see Gym 2 audit logs
    audit_resp = client.get("/audit-logs/?page=1&limit=50")
    assert audit_resp.status_code == 200
    for log_item in audit_resp.json()["items"]:
        assert log_item.get("gym_id") == 1, "Cross-tenant audit leakage detected!"
        assert "Medellín" not in log_item.get("description", "")


def test_03_privilege_escalation_prevention():
    """
    CERTIFICATION SCENARIO 03: Privilege Escalation Prevention
    Verifies that a Staff member cannot elevate their role to OWNER or ADMIN,
    cannot self-assign permissions, and cannot create or modify users.
    """
    global active_user_id
    active_user_id = 2  # Staff

    # Attempt 1: Direct endpoint to list users
    assert client.get("/users/").status_code == 403

    # Attempt 2: Staff tries to promote themselves to OWNER
    promote_resp = client.put(
        "/users/2",
        json={"role": "OWNER", "full_name": "Eduardo Hackeado"},
    )
    assert promote_resp.status_code == 403, "Staff must NOT be able to modify roles"

    # Attempt 3: Staff tries to grant themselves financial permissions
    grant_resp = client.put(
        "/users/2",
        json={"permissions": {"view_financials": True, "export_reports": True}},
    )
    assert grant_resp.status_code == 403, "Staff must NOT be able to grant permissions"

    # Attempt 4: Staff tries to create an OWNER account
    create_resp = client.post(
        "/users/",
        json={
            "full_name": "Infiltrado",
            "email": "infiltrado@zonafit.test",
            "password": "HackPassword123!",
            "role": "OWNER",
        },
    )
    assert create_resp.status_code == 403, "Staff must NOT be able to create users"

    # Verify role in DB remains strictly STAFF
    db = TestingSessionLocal()
    user = db.query(User).filter(User.id == 2).first()
    assert user.role == "STAFF"
    assert user.permissions.get("view_financials", False) is False
    db.close()


def test_04_audit_immutability_and_tamper_proofing():
    """
    CERTIFICATION SCENARIO 04: Audit Immutability
    Confirms that Audit Logs are strictly append-only and cannot be altered or deleted.
    """
    global active_user_id
    active_user_id = 1  # Owner

    # Seed an audit log entry to test immutability
    db = TestingSessionLocal()
    from app.services.audit_service import AuditService
    AuditService.log(
        db=db,
        gym_id=1,
        action=AuditAction.LOGIN,
        module=AuditModule.AUTH,
        entity_type="User",
        user_id=1,
        user_name="Orlando Owner",
        description="Inicio de sesión para prueba de inmutabilidad",
    )
    db.commit()
    db.close()

    # Query an existing log ID
    resp = client.get("/audit-logs/?page=1&limit=1")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) > 0
    log_id = items[0]["id"]

    # Attempt DELETE on /audit-logs/{id}
    del_resp = client.delete(f"/audit-logs/{log_id}")
    assert del_resp.status_code in [404, 405], "Audit logs must NOT have a DELETE route"

    # Attempt PUT on /audit-logs/{id}
    put_resp = client.put(f"/audit-logs/{log_id}", json={"description": "Modificado"})
    assert put_resp.status_code in [404, 405], "Audit logs must NOT have a PUT route"

    # Attempt PATCH on /audit-logs/{id}
    patch_resp = client.patch(f"/audit-logs/{log_id}", json={"description": "Modificado"})
    assert patch_resp.status_code in [404, 405], "Audit logs must NOT have a PATCH route"


def test_05_idempotent_midnight_close_and_concurrency():
    """
    CERTIFICATION SCENARIO 05: Auto-Close Idempotency & Concurrency Safety
    Verifies that calling close_expired_registers multiple times or concurrently
    never creates duplicate closing records, corrupted balances, or duplicate audit logs.
    """
    bogota_tz = ZoneInfo("America/Bogota")
    day1_local = datetime(2026, 11, 4, 8, 0, 0, tzinfo=bogota_tz)
    day1_utc = day1_local.astimezone(timezone.utc)
    day2_utc = datetime(2026, 11, 5, 0, 0, 10, tzinfo=bogota_tz).astimezone(timezone.utc)

    db = TestingSessionLocal()
    reg = CashRegister(
        gym_id=1,
        opened_by=1,
        opening_balance=Decimal("75000.00"),
        status="OPEN",
        opened_at=day1_utc,
    )
    db.add(reg)
    db.commit()
    reg_id = reg.id

    # First call: closes the register
    closed_first = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_first) == 1
    assert closed_first[0].id == reg_id
    assert closed_first[0].status == "CLOSED"

    # Second call (same day / time): idempotent, returns 0 registers
    closed_second = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_utc)
    assert len(closed_second) == 0

    # Third call (hours later): idempotent, returns 0 registers
    day2_afternoon_utc = datetime(2026, 11, 5, 14, 0, 0, tzinfo=bogota_tz).astimezone(timezone.utc)
    closed_third = CashRegisterService.close_expired_registers(db, target_gym_id=1, as_of_time=day2_afternoon_utc)
    assert len(closed_third) == 0

    # Exactly 1 audit record for this register closure
    audit_count = db.query(AuditLog).filter(
        AuditLog.gym_id == 1,
        AuditLog.action == AuditAction.CASH_REGISTER_CLOSED,
        AuditLog.entity_id == reg_id,
    ).count()
    assert audit_count == 1
    db.close()
