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
from app.models.payment import Payment
from app.models.sale import Sale
from app.models.product import Product
from app.models.category import Category
from app.models.cash_register import CashRegister
from app.models.audit_log import AuditLog
from app.models.subscription import Subscription, SubscriptionStatus
from app.constants.membership_status import MembershipStatus
from app.constants.audit_actions import AuditAction, AuditModule

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


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    global current_test_user
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 (Principal)
    gym1 = Gym(id=1, name="Gym Audit Alpha", email="alpha@zonafit.com", owner_id=1)
    db.add(gym1)

    # Gym 2 (Aislado)
    gym2 = Gym(id=2, name="Gym Audit Beta", email="beta@zonafit.com", owner_id=3)
    db.add(gym2)

    # Subscriptions
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

    # Admin Gym 1
    admin_gym1 = User(
        id=1,
        gym_id=1,
        email="admin@alpha.com",
        full_name="Carlos Administrador",
        role="ADMIN",
        password=hash_password("admin123"),
        is_active=True,
    )
    db.add(admin_gym1)

    # Staff Gym 1
    staff_gym1 = User(
        id=2,
        gym_id=1,
        email="staff@alpha.com",
        full_name="Pedro Empleado",
        role="STAFF",
        password=hash_password("staff123"),
        is_active=True,
    )
    db.add(staff_gym1)

    # Admin Gym 2
    admin_gym2 = User(
        id=3,
        gym_id=2,
        email="admin@beta.com",
        full_name="Beatriz Beta",
        role="ADMIN",
        password=hash_password("admin123"),
        is_active=True,
    )
    db.add(admin_gym2)

    db.commit()
    db.close()

    current_test_user = admin_gym1
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    Base.metadata.drop_all(bind=engine)


def test_01_create_client_and_audit():
    """Creación de cliente genera evento CLIENT_CREATED con descripción comprensible y actor real."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "full_name": "Juan Rodríguez",
        "document_type": "CC",
        "document": "100200300",
        "phone": "3001112233",
        "email": "juan@test.com",
    }
    res = client.post("/clients/", json=payload)
    assert res.status_code == 201
    created_id = res.json()["id"]

    # Verificar audit log
    audit_res = client.get("/audit-logs/")
    assert audit_res.status_code == 200
    items = audit_res.json()["items"]
    assert len(items) >= 1
    log = next(i for i in items if i["entity_id"] == created_id and i["action"] == AuditAction.CLIENT_CREATED)

    assert log["user_name"] == "Carlos Administrador"
    assert log["user_id"] == 1
    assert log["module"] == AuditModule.CLIENTS
    assert log["entity_type"] == "Client"
    assert "Juan Rodríguez" in log["description"]
    assert "Carlos Administrador" in log["description"]
    db.close()


def test_02_membership_creation_and_renewal_audit():
    """Registro inicial de membresía genera MEMBERSHIP_CREATED y renovación genera MEMBERSHIP_RENEWED."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Setup Plan & Client
    plan = MembershipPlan(
        id=1, gym_id=1, name="Plan Mensual Pro", duration_days=30, price=Decimal("80000.00"), is_active=True
    )
    cl = Client(id=1, gym_id=1, full_name="María Gómez", document_type="CC", document="998877", phone="3001234567", is_active=True)
    db.add_all([plan, cl])
    db.commit()

    # 1. Crear membresía inicial
    res1 = client.post(
        "/memberships/",
        json={"client_id": 1, "membership_plan_id": 1, "payment_method": "CASH", "amount_paid": 80000},
    )
    assert res1.status_code == 201

    logs1 = client.get("/audit-logs/?module=MEMBERSHIPS").json()["items"]
    mem_created = next((l for l in logs1 if l["action"] == AuditAction.MEMBERSHIP_CREATED), None)
    assert mem_created is not None
    assert "registró una nueva membresía (Plan Mensual Pro) para María Gómez" in mem_created["description"]
    assert mem_created["user_name"] == "Carlos Administrador"

    # 2. Renovar membresía
    res2 = client.post(
        "/memberships/",
        json={"client_id": 1, "membership_plan_id": 1, "payment_method": "CASH", "amount_paid": 80000},
    )
    assert res2.status_code == 201

    logs2 = client.get("/audit-logs/?module=MEMBERSHIPS").json()["items"]
    mem_renewed = next((l for l in logs2 if l["action"] == AuditAction.MEMBERSHIP_RENEWED), None)
    assert mem_renewed is not None
    assert "renovó la membresía (Plan Mensual Pro) para María Gómez" in mem_renewed["description"]
    db.close()


def test_03_payment_and_reversal_audit():
    """Registro de pago genera PAYMENT_CREATED y anulación genera PAYMENT_CANCELLED."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    plan = MembershipPlan(
        id=2, gym_id=1, name="Plan Trimestral", duration_days=90, price=Decimal("200000.00"), is_active=True
    )
    cl = Client(id=2, gym_id=1, full_name="Andrés Castro", document_type="CC", document="554433", phone="3007654321", is_active=True)
    db.add_all([plan, cl])
    db.commit()

    # Crear membresía sin pago completo
    mem_res = client.post(
        "/memberships/",
        json={"client_id": 2, "membership_plan_id": 2, "payment_method": "CASH", "amount_paid": 0},
    )
    assert mem_res.status_code == 201
    mem_id = mem_res.json()["id"]

    # Registrar abono/pago
    pay_res = client.post(
        "/payments/",
        json={"membership_id": mem_id, "amount": 100000, "payment_method": "TRANSFER"},
    )
    assert pay_res.status_code == 201
    pay_id = pay_res.json()["id"]

    pay_logs = client.get("/audit-logs/?module=PAYMENTS").json()["items"]
    created_log = next((l for l in pay_logs if l["action"] == AuditAction.PAYMENT_CREATED), None)
    assert created_log is not None
    assert "registró un pago de $100,000 (TRANSFER)" in created_log["description"]

    # Anular pago
    del_res = client.delete(f"/payments/{pay_id}")
    assert del_res.status_code == 204

    cancel_logs = client.get("/audit-logs/?module=PAYMENTS").json()["items"]
    cancel_log = next((l for l in cancel_logs if l["action"] == AuditAction.PAYMENT_CANCELLED), None)
    assert cancel_log is not None
    assert f"anuló el pago #{pay_id}" in cancel_log["description"]
    db.close()


def test_04_cash_register_lifecycle_audit():
    """Apertura, movimiento de efectivo y cierre de caja generan eventos de auditoría comprensibles."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Apertura
    open_res = client.post("/cash-registers/open", json={"opening_balance": 50000.00})
    assert open_res.status_code in [200, 201]
    reg_id = open_res.json()["id"]

    open_logs = client.get("/audit-logs/?module=CASH_REGISTER").json()["items"]
    open_log = next((l for l in open_logs if l["action"] == AuditAction.CASH_REGISTER_OPENED), None)
    assert open_log is not None
    assert f"apertura de caja #{reg_id} con base de $50,000" in open_log["description"]

    # 2. Movimiento manual (gasto de caja)
    mov_res = client.post(
        "/cash-registers/movements",
        json={"amount": 15000.00, "type": "OUT", "category": "EXPENSE", "description": "Compra de artículos de aseo"},
    )
    assert mov_res.status_code in [200, 201]
    mov_logs = client.get("/audit-logs/?module=CASH_REGISTER").json()["items"]
    mov_log = next((l for l in mov_logs if l["action"] == AuditAction.CASH_MOVEMENT_CREATED), None)
    assert mov_log is not None
    assert "Compra de artículos de aseo" in mov_log["description"]

    # 3. Cierre de caja
    close_res = client.post(
        f"/cash-registers/{reg_id}/close",
        json={"counted_balance": 35000.00, "closing_notes": "Cuadre exacto del turno"},
    )
    assert close_res.status_code == 200
    close_logs = client.get("/audit-logs/?module=CASH_REGISTER").json()["items"]
    close_log = next((l for l in close_logs if l["action"] == AuditAction.CASH_REGISTER_CLOSED), None)
    assert close_log is not None
    assert f"cierre de caja #{reg_id}" in close_log["description"]
    db.close()


def test_05_inventory_movements_and_products_audit():
    """Operaciones de inventario y modificación de productos generan auditoría detallada."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    cat = Category(id=1, gym_id=1, name="Bebidas", is_active=True)
    db.add(cat)
    db.commit()

    # 1. Crear producto
    prod_res = client.post(
        "/products/",
        json={
            "name": "Bebida Isotónica 500ml",
            "sku": "BEB-001",
            "purchase_price": 2500,
            "sale_price": 4500,
            "stock": 20,
            "minimum_stock": 5,
            "category_id": 1,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    p_logs = client.get("/audit-logs/?module=INVENTORY").json()["items"]
    created_p = next((l for l in p_logs if l["action"] == AuditAction.PRODUCT_CREATED), None)
    assert created_p is not None
    assert "creó el producto Bebida Isotónica 500ml" in created_p["description"]

    # 2. Registrar movimiento de inventario manual
    mov_res = client.post(
        "/inventory-movements/",
        json={
            "product_id": prod_id,
            "movement_type": "IN",
            "quantity": 10,
            "reason": "Reposición de stock proveedor",
        },
    )
    assert mov_res.status_code == 201

    inv_logs = client.get("/audit-logs/?action=INVENTORY_MOVEMENT").json()["items"]
    assert len(inv_logs) >= 1
    assert "movimiento de inventario (IN: 10) en Bebida Isotónica 500ml" in inv_logs[0]["description"]
    db.close()


def test_06_pos_sales_cash_and_credit_audit():
    """Ventas POS de contado y a crédito registran eventos independientes con monto."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    cat = Category(id=2, gym_id=1, name="Suplementos", is_active=True)
    prod = Product(
        id=2,
        gym_id=1,
        category_id=2,
        name="Proteína Whey 1lb",
        sku="PROT-01",
        purchase_price=Decimal("60000.00"),
        sale_price=Decimal("95000.00"),
        stock=10,
    )
    cl = Client(id=3, gym_id=1, full_name="Laura Morales", document_type="CC", document="112233", phone="3009988776", is_active=True)
    db.add_all([cat, prod, cl])
    db.commit()

    # Venta de contado vía checkout
    res_cash = client.post(
        "/sales/checkout",
        json={
            "sale_type": "CASH",
            "payment_method": "TRANSFER",
            "items": [{"product_id": 2, "quantity": 1, "unit_price": 95000}],
        },
    )
    assert res_cash.status_code == 201

    sales_logs = client.get("/audit-logs/?module=SALES").json()["items"]
    cash_log = next((l for l in sales_logs if l["action"] == AuditAction.SALE_CREATED), None)
    assert cash_log is not None
    assert "registró una venta de contado por $95,000" in cash_log["description"]

    # Venta a crédito
    due_date = (datetime.now(timezone.utc) + timedelta(days=15)).isoformat()
    res_credit = client.post(
        "/sales/checkout",
        json={
            "client_id": 3,
            "sale_type": "CREDIT",
            "payment_method": "TRANSFER",
            "due_date": due_date,
            "initial_payment": 20000,
            "items": [{"product_id": 2, "quantity": 1, "unit_price": 95000}],
        },
    )
    assert res_credit.status_code == 201
    credit_logs = client.get("/audit-logs/?action=CREDIT_SALE_CREATED").json()["items"]
    assert len(credit_logs) >= 1
    assert "Laura Morales" in credit_logs[0]["description"]
    db.close()


def test_07_multitenant_isolation():
    """Un gimnasio nunca puede consultar los registros de auditoría de otro gimnasio."""
    global current_test_user
    db = TestingSessionLocal()

    # Acción en Gym 1
    current_test_user = db.query(User).filter(User.id == 1).first()
    client.post("/clients/", json={"full_name": "Socio Alpha", "document_type": "CC", "document": "A-123", "phone": "3000000000"})

    # Cambio a Admin Gym 2
    current_test_user = db.query(User).filter(User.id == 3).first()
    res_beta = client.get("/audit-logs/")
    assert res_beta.status_code == 200
    beta_items = res_beta.json()["items"]

    # Debe ver únicamente registros de gym 2 (en este caso 0)
    assert len(beta_items) == 0
    assert not any("Socio Alpha" in str(item) for item in beta_items)
    db.close()


def test_08_security_staff_forbidden_and_immutability():
    """Los empleados no pueden ver la auditoría y no existen endpoints para modificarla."""
    global current_test_user
    db = TestingSessionLocal()

    # Usuario STAFF de Gym 1 intenta consultar auditoría -> 403 Forbidden
    current_test_user = db.query(User).filter(User.id == 2).first()
    res = client.get("/audit-logs/")
    assert res.status_code == 403

    # Inmutabilidad: No se puede hacer DELETE ni PUT en /audit-logs/
    res_delete = client.delete("/audit-logs/1")
    assert res_delete.status_code in [404, 405]

    res_put = client.put("/audit-logs/1", json={"description": "Modificado"})
    assert res_put.status_code in [404, 405]
    db.close()


def test_09_historical_records_graceful_enrichment():
    """Registros antiguos con user_name o description en NULL se muestran enriquecidos sin romper."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Insertar manualmente registro histórico sin user_name ni description
    old_log = AuditLog(
        gym_id=1,
        user_id=1,
        action="CREATE",
        entity_type="Client",
        entity_id=999,
        created_at=datetime.now(timezone.utc) - timedelta(days=100),
    )
    db.add(old_log)
    db.commit()

    res = client.get("/audit-logs/?search=999")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    item = items[0]
    assert item["user_name"] == "Carlos Administrador"  # Resuelto desde relación user
    assert item["module"] == AuditModule.CLIENTS
    assert "999" in item["description"]
    db.close()


def test_10_filters_and_search():
    """Filtros por módulo, acción, usuario y búsqueda libre funcionan correctamente."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Búsqueda por texto
    res_search = client.get("/audit-logs/?search=Alpha")
    assert res_search.status_code == 200

    # Filtro por módulo
    res_mod = client.get("/audit-logs/?module=CLIENTS")
    assert res_mod.status_code == 200
    for item in res_mod.json()["items"]:
        assert item["module"] == "CLIENTS"

    # Filtro por usuario
    res_usr = client.get("/audit-logs/?user_id=1")
    assert res_usr.status_code == 200
    for item in res_usr.json()["items"]:
        assert item["user_id"] == 1
    db.close()
