import pytest
import json
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
from app.models.category import Category
from app.models.product import Product
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.accounts_receivable import AccountsReceivable
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_cash_reconciliation_p4x.db"
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
def setup_db():
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
    user1 = User(id=1, gym_id=1, full_name="Admin Alpha", email="admin1@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin2@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Category & Product
    cat1 = Category(id=1, gym_id=1, name="Suplementos", is_active=True)
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Bebida Isotónica", sku="ISO-1", purchase_price=3000.0, sale_price=5000.0, stock=100, minimum_stock=5, is_active=True)
    db.add_all([cat1, prod1])

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Carlos Gomez", document_type="CC", document="101010", phone="3001112233", is_active=True)
    client2 = Client(id=2, gym_id=2, full_name="Laura Ramos", document_type="CC", document="202020", phone="3004445566", is_active=True)
    db.add_all([client1, client2])

    # Plan
    plan1 = MembershipPlan(id=1, gym_id=1, name="Mes Completo", price=100000.0, duration_days=30, is_active=True)
    db.add(plan1)

    db.commit()
    db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()


def set_user(user_id=1, gym_id=1):
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == user_id, User.gym_id == gym_id).first()
    db.close()


def clean_cash_data():
    db = TestingSessionLocal()
    db.query(CashMovement).delete()
    db.query(CashRegister).delete()
    db.query(Payment).delete()
    db.query(SaleDetail).delete()
    db.query(Sale).delete()
    db.query(Membership).delete()
    db.query(AccountsReceivable).delete()
    db.commit()
    db.close()


def helper_create_sale_payment(db, gym_id: int, amount: Decimal, payment_method: str) -> Payment:
    sale = Sale(gym_id=gym_id, client_id=1, total=amount, status="COMPLETED", is_active=True)
    db.add(sale)
    db.flush()
    payment = Payment(
        gym_id=gym_id,
        sale_id=sale.id,
        amount=amount,
        payment_method=payment_method,
        status="PAID",
        is_active=True
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


# 1. Caja únicamente con efectivo
def test_01_cash_only_summary():
    clean_cash_data()
    set_user(1, 1)

    # Open with 50,000 COP
    res_open = client.post("/cash-registers/open", json={"opening_balance": 50000.0})
    assert res_open.status_code == 201

    # Manual IN 20,000 COP
    res_mov = client.post("/cash-registers/movements", json={"amount": 20000.0, "type": "IN", "category": "MANUAL_IN", "description": "Sencillo"})
    assert res_mov.status_code == 201

    # Get summary
    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert float(data["opening_balance"]) == 50000.0
    assert float(data["cash_incomes"]) == 20000.0
    assert float(data["cash_outcomes"]) == 0.0
    assert float(data["expected_cash"]) == 70000.0
    assert len(data["payment_methods"]) == 1
    assert data["payment_methods"][0]["method"] == "CASH"


# 2. Caja con efectivo + transferencia
def test_02_cash_plus_transfer_summary():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    # Open register
    client.post("/cash-registers/open", json={"opening_balance": 50000.0})

    # Payment in CASH & TRANSFER
    helper_create_sale_payment(db, 1, Decimal("30000.00"), "CASH")
    helper_create_sale_payment(db, 1, Decimal("45000.00"), "TRANSFER")
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert float(data["expected_cash"]) == 50000.0  # payments table without cash movement doesn't alter expected cash
    methods = {m["method"]: float(m["registered_amount"]) for m in data["payment_methods"]}
    assert methods["CASH"] == 30000.0
    assert methods["TRANSFER"] == 45000.0


# 3. Caja con efectivo + tarjeta
def test_03_cash_plus_card_summary():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    client.post("/cash-registers/open", json={"opening_balance": 10000.0})
    helper_create_sale_payment(db, 1, Decimal("80000.00"), "CARD")
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert float(data["expected_cash"]) == 10000.0
    methods = {m["method"]: float(m["registered_amount"]) for m in data["payment_methods"]}
    assert methods["CARD"] == 80000.0


# 4. Caja con múltiples medios (Efectivo + Transferencia + Tarjeta)
def test_04_multiple_methods_summary():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    client.post("/cash-registers/open", json={"opening_balance": 50000.0})
    helper_create_sale_payment(db, 1, Decimal("20000.00"), "CASH")
    helper_create_sale_payment(db, 1, Decimal("30000.00"), "TRANSFER")
    helper_create_sale_payment(db, 1, Decimal("15000.00"), "CARD")
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    methods = {m["method"]: float(m["registered_amount"]) for m in data["payment_methods"]}
    assert methods["CASH"] == 20000.0
    assert methods["TRANSFER"] == 30000.0
    assert methods["CARD"] == 15000.0


# 5. Efectivo cuadrado ($0 diferencia)
def test_05_cash_square_close():
    clean_cash_data()
    set_user(1, 1)

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    client.post("/cash-registers/movements", json={"amount": 10000.0, "type": "IN", "category": "MANUAL_IN"})
    
    # Expected is 60,000. User counts 60,000
    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 60000.0,
        "closing_notes": "Caja cuadrada perfecta"
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    assert float(closed["difference"]) == 0.0
    assert float(closed["expected_balance"]) == 60000.0
    assert closed["status"] == "CLOSED"


# 6. Efectivo con faltante (-$X)
def test_06_cash_deficit_close():
    clean_cash_data()
    set_user(1, 1)

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    
    # Expected is 50,000. User counts 45,000 (Faltante 5,000)
    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 45000.0,
        "closing_notes": "Faltante en monedas"
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    assert float(closed["difference"]) == -5000.0
    assert float(closed["counted_balance"]) == 45000.0


# 7. Efectivo con sobrante (+$X)
def test_07_cash_surplus_close():
    clean_cash_data()
    set_user(1, 1)

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    
    # Expected is 50,000. User counts 52,000 (Sobrante 2,000)
    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 52000.0,
        "closing_notes": "Sobrante propina"
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    assert float(closed["difference"]) == 2000.0


# 8. Transferencia cuadrada
def test_08_transfer_reconciliation_square():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    helper_create_sale_payment(db, 1, Decimal("40000.00"), "TRANSFER")
    db.close()

    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 50000.0,
        "reconciliations": [
            {
                "method": "TRANSFER",
                "registered_amount": 40000.0,
                "verified_amount": 40000.0,
                "difference": 0.0,
                "status": "CUADRADO"
            }
        ]
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    reconcil = json.loads(closed["reconciliation_data"])
    assert len(reconcil) == 1
    assert reconcil[0]["method"] == "TRANSFER"
    assert float(reconcil[0]["difference"]) == 0.0
    assert reconcil[0]["status"] == "CUADRADO"


# 9. Transferencia con diferencia
def test_09_transfer_reconciliation_difference():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    helper_create_sale_payment(db, 1, Decimal("40000.00"), "TRANSFER")
    db.close()

    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 50000.0,
        "reconciliations": [
            {
                "method": "TRANSFER",
                "registered_amount": 40000.0,
                "verified_amount": 35000.0,
                "difference": -5000.0,
                "status": "FALTANTE"
            }
        ]
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    reconcil = json.loads(closed["reconciliation_data"])
    assert float(reconcil[0]["difference"]) == -5000.0
    assert reconcil[0]["status"] == "FALTANTE"


# 10. Tarjeta con diferencia
def test_10_card_reconciliation_difference():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    helper_create_sale_payment(db, 1, Decimal("60000.00"), "CARD")
    db.close()

    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 50000.0,
        "reconciliations": [
            {
                "method": "CARD",
                "registered_amount": 60000.0,
                "verified_amount": 65000.0,
                "difference": 5000.0,
                "status": "SOBRANTE"
            }
        ]
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    reconcil = json.loads(closed["reconciliation_data"])
    assert float(reconcil[0]["difference"]) == 5000.0
    assert reconcil[0]["status"] == "SOBRANTE"


# 11. Membresía pagada parcialmente
def test_11_partial_membership_reconciliation():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()

    # Create underlying sale
    sale = Sale(gym_id=1, client_id=1, total=Decimal("100000.00"), status="COMPLETED", is_active=True)
    db.add(sale)
    db.flush()

    # Client pays 40k in TRANSFER, owes 60k
    ar = AccountsReceivable(
        gym_id=1, client_id=1, sale_id=sale.id, original_amount=Decimal("100000.00"),
        paid_amount=Decimal("40000.00"), balance_due=Decimal("60000.00"),
        status="PARTIAL", is_active=True
    )
    db.add(ar)
    db.flush()

    p = Payment(
        gym_id=1, accounts_receivable_id=ar.id, amount=Decimal("40000.00"),
        payment_method="TRANSFER", status="PAID", is_active=True
    )
    db.add(p)
    db.commit()
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert float(data["expected_cash"]) == 50000.0
    methods = {m["method"]: float(m["registered_amount"]) for m in data["payment_methods"]}
    assert methods["TRANSFER"] == 40000.0


# 12. Pago posterior de crédito (Abono)
def test_12_credit_abono_reconciliation():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()

    sale = Sale(gym_id=1, client_id=1, total=Decimal("100000.00"), status="COMPLETED", is_active=True)
    db.add(sale)
    db.flush()

    ar = AccountsReceivable(
        gym_id=1, client_id=1, sale_id=sale.id, original_amount=Decimal("100000.00"),
        paid_amount=Decimal("60000.00"), balance_due=Decimal("40000.00"),
        status="PARTIAL", is_active=True
    )
    db.add(ar)
    db.flush()

    p = Payment(gym_id=1, accounts_receivable_id=ar.id, amount=Decimal("60000.00"), payment_method="CASH", status="PAID", is_active=True)
    mov = CashMovement(gym_id=1, cash_register_id=reg["id"], amount=Decimal("60000.00"), type="IN", category="CREDIT_PAYMENT", created_by=1)
    db.add_all([p, mov])
    db.commit()
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert float(data["expected_cash"]) == 110000.0
    assert float(data["cash_incomes"]) == 60000.0


# 13. Venta POS
def test_13_pos_sale_reconciliation():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()

    # POS sale paid via CARD
    sale = Sale(gym_id=1, client_id=1, total=Decimal("15000.00"), status="COMPLETED", is_active=True)
    db.add(sale)
    db.flush()

    p = Payment(gym_id=1, sale_id=sale.id, amount=Decimal("15000.00"), payment_method="CARD", status="PAID", is_active=True)
    db.add(p)
    db.commit()
    db.close()

    res_sum = client.get("/cash-registers/active/summary")
    assert res_sum.status_code == 200
    data = res_sum.json()
    methods = {m["method"]: float(m["registered_amount"]) for m in data["payment_methods"]}
    assert methods["CARD"] == 15000.0


# 14. Verificación de que la conciliación NO crea Payment duplicados
def test_14_reconciliation_no_duplicate_payments():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    helper_create_sale_payment(db, 1, Decimal("30000.00"), "TRANSFER")
    
    count_before = db.query(Payment).count()
    db.close()

    # Close with reconciliation
    client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 50000.0,
        "reconciliations": [
            {"method": "TRANSFER", "registered_amount": 30000.0, "verified_amount": 30000.0, "difference": 0.0, "status": "CUADRADO"}
        ]
    })

    db = TestingSessionLocal()
    count_after = db.query(Payment).count()
    db.close()
    assert count_before == count_after == 1


# 15. Verificación de que la conciliación NO crea CashMovement duplicados
def test_15_reconciliation_no_duplicate_movements():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    mov = CashMovement(gym_id=1, cash_register_id=reg["id"], amount=Decimal("20000.00"), type="IN", category="MANUAL_IN", created_by=1)
    db.add(mov)
    db.commit()

    count_before = db.query(CashMovement).count()
    db.close()

    # Close with reconciliation
    client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 70000.0,
        "reconciliations": [
            {"method": "CASH", "registered_amount": 70000.0, "verified_amount": 70000.0, "difference": 0.0, "status": "CUADRADO"}
        ]
    })

    db = TestingSessionLocal()
    count_after = db.query(CashMovement).count()
    db.close()
    assert count_before == count_after == 1


# 16. Multi-tenant (aislamiento entre gym1 y gym2)
def test_16_multi_tenant_isolation():
    clean_cash_data()
    
    # User 1 opens register in Gym 1
    set_user(1, 1)
    reg1 = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    
    # User 2 opens register in Gym 2
    set_user(2, 2)
    reg2 = client.post("/cash-registers/open", json={"opening_balance": 100000.0}).json()

    # Gym 1 payment & Gym 2 payment
    set_user(1, 1)
    db = TestingSessionLocal()
    helper_create_sale_payment(db, 1, Decimal("25000.00"), "TRANSFER")
    helper_create_sale_payment(db, 2, Decimal("99000.00"), "TRANSFER")
    db.close()

    # Check Gym 1 summary only sees Gym 1 payment
    res1 = client.get("/cash-registers/active/summary")
    assert res1.status_code == 200
    methods1 = {m["method"]: float(m["registered_amount"]) for m in res1.json()["payment_methods"]}
    assert methods1["TRANSFER"] == 25000.0

    # Check Gym 2 summary only sees Gym 2 payment
    set_user(2, 2)
    res2 = client.get("/cash-registers/active/summary")
    assert res2.status_code == 200
    methods2 = {m["method"]: float(m["registered_amount"]) for m in res2.json()["payment_methods"]}
    assert methods2["TRANSFER"] == 99000.0


# 17. Cierre realizado por usuario autorizado
def test_17_authorized_user_close():
    clean_cash_data()
    set_user(1, 1)

    reg = client.post("/cash-registers/open", json={"opening_balance": 30000.0}).json()
    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={"counted_balance": 30000.0})
    assert res_close.status_code == 200
    assert res_close.json()["closed_by"] == 1


# 18. Usuario de otro gimnasio rechazado (400/404)
def test_18_cross_tenant_close_rejected():
    clean_cash_data()
    set_user(1, 1)
    reg1 = client.post("/cash-registers/open", json={"opening_balance": 30000.0}).json()

    # User 2 from Gym 2 tries to close Gym 1's register
    set_user(2, 2)
    res_close = client.post(f"/cash-registers/{reg1['id']}/close", json={"counted_balance": 30000.0})
    assert res_close.status_code in [400, 404]


# 19. Cierre con múltiples medios y persistencia de reconciliación JSON
def test_19_multiple_methods_close_and_json_persistence():
    clean_cash_data()
    set_user(1, 1)
    db = TestingSessionLocal()

    reg = client.post("/cash-registers/open", json={"opening_balance": 50000.0}).json()
    helper_create_sale_payment(db, 1, Decimal("20000.00"), "CASH")
    helper_create_sale_payment(db, 1, Decimal("30000.00"), "TRANSFER")
    helper_create_sale_payment(db, 1, Decimal("15000.00"), "CARD")
    db.close()

    res_close = client.post(f"/cash-registers/{reg['id']}/close", json={
        "counted_balance": 70000.0,
        "closing_notes": "Cierre completo con múltiples medios",
        "reconciliations": [
            {"method": "CASH", "registered_amount": 70000.0, "verified_amount": 70000.0, "difference": 0.0, "status": "CUADRADO"},
            {"method": "TRANSFER", "registered_amount": 30000.0, "verified_amount": 30000.0, "difference": 0.0, "status": "CUADRADO"},
            {"method": "CARD", "registered_amount": 15000.0, "verified_amount": 15000.0, "difference": 0.0, "status": "CUADRADO"}
        ]
    })
    assert res_close.status_code == 200
    closed = res_close.json()
    assert closed["status"] == "CLOSED"
    assert closed["reconciliation_data"] is not None
    data = json.loads(closed["reconciliation_data"])
    assert len(data) == 3


# 20. Consulta histórica y persistencia íntegra de reconciliation_data
def test_20_historical_registers_and_reconciliation_integrity():
    set_user(1, 1)
    res_list = client.get("/cash-registers/")
    assert res_list.status_code == 200
    registers = res_list.json()
    assert len(registers) > 0
    latest = registers[0]
    assert latest["reconciliation_data"] is not None
    reconcil = json.loads(latest["reconciliation_data"])
    assert isinstance(reconcil, list)
    assert len(reconcil) == 3
