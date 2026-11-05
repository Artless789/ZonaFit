import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
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
from app.models.product import Product
from app.models.category import Category
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.cash_register import CashRegister
from app.constants.membership_status import MembershipStatus
from app.constants.sale_status import SaleStatus
from app.constants.permissions import Role, Permission

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
    if current_test_user_id:
        return db.query(User).filter(User.id == current_test_user_id).first()
    return None


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    global current_test_user_id
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 (Principal)
    gym1 = Gym(id=1, name="Gym Principal", email="principal@zonafit.com", owner_id=1)
    db.add(gym1)

    # Gym 2 (Aislado)
    gym2 = Gym(id=2, name="Gym Secundario", email="secundario@zonafit.com", owner_id=4)
    db.add(gym2)

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

    # 1. OWNER Gym 1
    owner_user = User(
        id=1,
        gym_id=1,
        full_name="Octavio Owner",
        email="owner@zonafit.com",
        role="OWNER",
        password=hash_password("owner123"),
        is_active=True,
    )
    db.add(owner_user)

    # 2. ADMIN Gym 1 (Permisos por defecto de Admin)
    admin_user = User(
        id=2,
        gym_id=1,
        full_name="Adriana Admin",
        email="admin@zonafit.com",
        role="ADMIN",
        password=hash_password("admin123"),
        is_active=True,
    )
    db.add(admin_user)

    # 3. EMPLOYEE / STAFF Gym 1 (Personal operativo base)
    employee_user = User(
        id=3,
        gym_id=1,
        full_name="Eduardo Empleado",
        email="empleado@zonafit.com",
        role="STAFF",
        password=hash_password("staff123"),
        is_active=True,
    )
    db.add(employee_user)

    # 4. OWNER Gym 2
    owner_gym2 = User(
        id=4,
        gym_id=2,
        full_name="Bruno Beta Owner",
        email="bruno@beta.com",
        role="OWNER",
        password=hash_password("owner123"),
        is_active=True,
    )
    db.add(owner_gym2)

    # Plan
    plan1 = MembershipPlan(
        id=1,
        gym_id=1,
        name="Plan Mensual Pro",
        price=Decimal("80000.00"),
        duration_days=30,
        is_active=True,
    )
    db.add(plan1)

    # Category and Product
    cat1 = Category(id=1, gym_id=1, name="Suplementos")
    db.add(cat1)
    prod1 = Product(
        id=1,
        gym_id=1,
        category_id=1,
        name="Proteína Whey",
        sku="WHEY-01",
        purchase_price=Decimal("50000.00"),
        sale_price=Decimal("80000.00"),
        stock=20,
        minimum_stock=5,
        is_active=True,
    )
    db.add(prod1)

    # Client Gym 1
    client1 = Client(
        id=1,
        gym_id=1,
        full_name="Juan Cliente Gym 1",
        document_type="CC",
        document="1001",
        phone="3001112233",
        email="juan1@test.com",
        is_active=True,
    )
    db.add(client1)

    # Client Gym 2
    client2 = Client(
        id=2,
        gym_id=2,
        full_name="Pedro Cliente Gym 2",
        document_type="CC",
        document="2002",
        phone="3004445566",
        email="pedro2@test.com",
        is_active=True,
    )
    db.add(client2)

    # Open Cash Register for Gym 1
    cash_reg = CashRegister(
        id=1,
        gym_id=1,
        opened_by=1,
        opened_at=now,
        opening_balance=Decimal("50000.00"),
        status="OPEN",
    )
    db.add(cash_reg)

    # A completed sale in Gym 1
    sale1 = Sale(
        id=1,
        gym_id=1,
        client_id=1,
        total=Decimal("80000.00"),
        status=SaleStatus.COMPLETED,
        is_active=True,
        created_at=now,
    )
    db.add(sale1)
    detail1 = SaleDetail(
        id=1,
        sale_id=1,
        product_id=1,
        quantity=1,
        unit_price=Decimal("80000.00"),
        subtotal=Decimal("80000.00"),
    )
    db.add(detail1)
    payment1 = Payment(
        id=1,
        gym_id=1,
        sale_id=1,
        amount=Decimal("80000.00"),
        payment_method="CASH",
        status="PAID",
        is_active=True,
        created_at=now,
    )
    db.add(payment1)

    db.commit()
    db.close()

    current_test_user_id = 1
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    Base.metadata.drop_all(bind=engine)


def test_01_employee_cannot_access_monthly_income_details():
    """1. Un empleado no puede consultar el desglose de ingresos mensuales globales (recibe 403 Forbidden)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    res = client.get("/dashboard/income-details")
    assert res.status_code == 403
    assert "Acceso denegado" in res.json()["detail"] or "view_financials" in res.json()["detail"]


def test_02_employee_dashboard_masks_global_financials():
    """2. El dashboard para empleado enmascara ingresos mensuales, tendencias y utilidades (mantiene métricas operativas)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    res = client.get("/dashboard/")
    assert res.status_code == 200
    data = res.json()

    # Totales financieros enmascarados a 0
    assert float(data["income_this_month"]) == 0.0
    assert float(data["sales_today_amount"]) == 0.0
    assert float(data["collected_today_amount"]) == 0.0
    assert float(data["total_receivables"]) == 0.0
    assert float(data["overdue_receivables"]) == 0.0
    assert data["daily_revenue_trend"] == []
    assert data["receivables"] == []

    # Métricas operativas preservadas
    assert data["active_clients"] >= 1
    assert data["sales_today"] >= 1
    for item in data["recent_activity"]:
        assert item["amount"] is None


def test_03_employee_cannot_access_profits_and_financial_reports():
    """3. Un empleado no puede consultar utilidades, ganancias ni reportes financieros de ventas (recibe 403)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    # Utilidades
    res_profit = client.get("/reports/profits")
    assert res_profit.status_code == 403

    # Reporte de ventas
    res_sales = client.get("/reports/sales")
    assert res_sales.status_code == 403

    # Reporte de ventas por fecha
    res_date = client.get("/reports/sales-by-date?start_date=2026-01-01&end_date=2026-12-31")
    assert res_date.status_code == 403

    # Reporte de pagos por método
    res_pay = client.get("/reports/payments-by-method")
    assert res_pay.status_code == 403

    # Reporte de productos top
    res_top = client.get("/reports/top-products")
    assert res_top.status_code == 403


def test_04_employee_cannot_access_audit_logs():
    """4. Un empleado operativo no puede consultar la bitácora de auditoría (recibe 403)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    res = client.get("/audit-logs/")
    assert res.status_code == 403

    res_single = client.get("/audit-logs/1")
    assert res_single.status_code == 403


def test_05_employee_cannot_modify_own_role_or_permissions():
    """5. Un empleado no puede cambiar su propio rol ni asignarse permisos (recibe 403)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    # Intentar cambiar rol a ADMIN
    res = client.put("/users/3", json={"role": "ADMIN"})
    assert res.status_code == 403

    # Intentar asignarse permisos de finanzas
    res_perm = client.put("/users/3", json={"permissions": {"view_financials": True}})
    assert res_perm.status_code == 403


def test_06_employee_cannot_manage_users_or_elevate_privileges():
    """6. Un empleado no puede administrar ni listar usuarios del sistema (recibe 403)."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    # Listar usuarios
    res_list = client.get("/users/")
    assert res_list.status_code == 403

    # Crear usuario
    res_create = client.post("/users/", json={
        "full_name": "Nuevo Empleado Falso",
        "email": "hacker@test.com",
        "role": "OWNER",
        "password": "Password123!"
    })
    assert res_create.status_code == 403


def test_07_employee_cross_tenant_isolation():
    """7. Un empleado no puede consultar datos ni clientes pertenecientes a otro gimnasio."""
    global current_test_user_id
    current_test_user_id = 3  # Employee Gym 1

    # Intentar consultar cliente del Gym 2 (ID: 2)
    res_client = client.get("/clients/2")
    assert res_client.status_code == 404

    # Intentar consultar usuario de otro gym
    res_user = client.get("/users/4")
    assert res_user.status_code == 403 or res_user.status_code == 404


def test_08_owner_has_full_access_to_all_financial_reports_and_settings():
    """8. El OWNER tiene acceso irrestricto a todos los reportes financieros, utilidades y auditoría."""
    global current_test_user_id
    current_test_user_id = 1  # Owner

    res_sales = client.get("/reports/sales")
    assert res_sales.status_code == 200
    assert float(res_sales.json()["total_income"]) >= 80000.0

    res_profits = client.get("/reports/profits")
    assert res_profits.status_code == 200
    profit_data = res_profits.json()
    assert float(profit_data["total_revenue"]) >= 80000.0
    assert float(profit_data["gross_profit"]) >= 30000.0  # 80k - 50k costo

    res_income = client.get("/dashboard/income-details")
    assert res_income.status_code == 200

    res_audit = client.get("/audit-logs/")
    assert res_audit.status_code == 200

    res_users = client.get("/users/")
    assert res_users.status_code == 200


def test_09_admin_with_limited_permissions_is_restricted():
    """9. Un ADMIN con permisos restringidos por el dueño es bloqueado en finanzas y auditoría, pero puede operar clientes."""
    global current_test_user_id
    db = TestingSessionLocal()

    # Dueño restringe permisos del Admin
    admin_u = db.query(User).filter(User.id == 2).first()
    admin_u.permissions = {
        "view_financials": False,
        "view_audit": False,
        "view_reports": False,
        "manage_clients": True,
    }
    db.commit()
    db.close()

    current_test_user_id = 2  # Limited Admin

    # Finanzas denegadas
    assert client.get("/reports/sales").status_code == 403
    assert client.get("/reports/profits").status_code == 403
    assert client.get("/dashboard/income-details").status_code == 403
    assert client.get("/audit-logs/").status_code == 403

    # Pero puede operar clientes
    res_client = client.post("/clients/", json={
        "full_name": "Cliente Creado Por Admin",
        "document_type": "CC",
        "document": "998877",
        "phone": "3007778899",
        "email": "clientadmin@test.com",
    })
    assert res_client.status_code == 201


def test_10_operational_employee_can_execute_daily_operations():
    """10. Un empleado operativo puede registrar clientes, ventas y pagos, pero no puede anularlos ni eliminar membresías."""
    global current_test_user_id
    current_test_user_id = 3  # Employee

    # 1. Crear cliente
    res_c = client.post("/clients/", json={
        "full_name": "Socio Nuevo Recepción",
        "document_type": "CC",
        "document": "556677",
        "phone": "3005556677",
        "email": "socio@recepcion.test",
    })
    assert res_c.status_code == 201
    cid = res_c.json()["id"]

    # 2. Registrar membresía
    res_m = client.post("/memberships/", json={
        "client_id": cid,
        "membership_plan_id": 1,
        "payment_method": "CASH",
        "amount_paid": 80000.0,
    })
    assert res_m.status_code == 201
    mid = res_m.json()["id"]

    # 3. Intentar anular/eliminar membresía -> 403 Denegado
    res_del_m = client.delete(f"/memberships/{mid}")
    assert res_del_m.status_code == 403

    # 4. Registrar venta POS
    res_s = client.post("/sales/checkout", json={
        "client_id": cid,
        "sale_type": "CASH",
        "payment_method": "CASH",
        "items": [{"product_id": 1, "quantity": 1}],
    })
    assert res_s.status_code == 201
    sid = res_s.json()["id"]

    # 5. Intentar anular/eliminar venta -> 403 Denegado
    res_del_s = client.delete(f"/sales/{sid}")
    assert res_del_s.status_code == 403
