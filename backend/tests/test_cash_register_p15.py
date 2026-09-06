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

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_cash_register_p15.db"
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
def setup_cash_register_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Uno", email="uno@gym.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Dos", email="dos@gym.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin Uno", email="admin1@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Dos", email="admin2@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Category & Product
    cat1 = Category(id=1, gym_id=1, name="Bebidas", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="Suplementos", is_active=True)
    db.add_all([cat1, cat2])
    
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Proteína 1kg", sku="PROT-1K", purchase_price=60000.0, sale_price=100000.0, stock=50, minimum_stock=5, is_active=True)
    prod2 = Product(id=2, gym_id=2, category_id=2, name="Creatina 300g", sku="CREA-300", purchase_price=40000.0, sale_price=80000.0, stock=20, minimum_stock=2, is_active=True)
    db.add_all([prod1, prod2])

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Juan Perez", document_type="CC", document="12345", phone="3001234567", is_active=True)
    client2 = Client(id=2, gym_id=2, full_name="Maria Lopez", document_type="CC", document="67890", phone="3009876543", is_active=True)
    db.add_all([client1, client2])

    # Membership Plan
    plan1 = MembershipPlan(id=1, gym_id=1, name="Mes Black", price=120000.0, duration_days=30, is_active=True)
    db.add(plan1)

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_open_cash_register():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Open cash register with initial 50,000 COP
    response = client.post("/cash-registers/open", json={"opening_balance": 50000.0})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "OPEN"
    assert float(data["opening_balance"]) == 50000.0
    assert data["gym_id"] == 1

    # 2. Verify active register endpoint
    active_resp = client.get("/cash-registers/active")
    assert active_resp.status_code == 200
    assert active_resp.json()["id"] == data["id"]

    # 3. Trying to open a second register when one is open should fail
    dup_resp = client.post("/cash-registers/open", json={"opening_balance": 20000.0})
    assert dup_resp.status_code == 400


def test_02_cash_sale_creates_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale: 1 unit of Proteina @ 100,000
    sale_resp = client.post("/sales/", json={"client_id": 1})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert complete_resp.status_code == 200

    # Verify CashMovement created in DB
    active_reg = client.get("/cash-registers/active").json()
    movements_resp = client.get(f"/cash-registers/{active_reg['id']}/movements")
    assert movements_resp.status_code == 200
    movements = movements_resp.json()
    
    sale_mov = next((m for m in movements if m["category"] == "SALE"), None)
    assert sale_mov is not None
    assert sale_mov["type"] == "IN"
    assert float(sale_mov["amount"]) == 100000.0


def test_03_card_sale_does_not_create_physical_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale: 1 unit of Proteina @ 100,000 with CARD
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CARD"})
    assert complete_resp.status_code == 200

    # Verify Payment exists
    payment = db.query(Payment).filter(Payment.sale_id == sale_id).first()
    assert payment is not None
    assert payment.payment_method == "CARD"

    # Verify NO CashMovement was generated for this CARD payment
    cash_mov = db.query(CashMovement).filter(CashMovement.payment_id == payment.id).first()
    assert cash_mov is None


def test_04_transfer_sale_does_not_create_physical_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale: 1 unit of Proteina @ 100,000 with TRANSFER
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})
    assert complete_resp.status_code == 200

    # Verify Payment exists
    payment = db.query(Payment).filter(Payment.sale_id == sale_id).first()
    assert payment is not None
    assert payment.payment_method == "TRANSFER"

    # Verify NO CashMovement was generated for this TRANSFER payment
    cash_mov = db.query(CashMovement).filter(CashMovement.payment_id == payment.id).first()
    assert cash_mov is None


def test_05_credit_sale_reflects_only_initial_received_cash():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Total sale = 100,000 COP, Initial payment in cash = 30,000 COP, Balance due = 70,000 COP
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={
        "sale_type": "CREDIT",
        "payment_method": "CASH",
        "due_date": "2026-10-01T00:00:00",
        "initial_payment": 30000.0
    })
    assert complete_resp.status_code == 200

    # Verify AR
    ar = db.query(AccountsReceivable).filter(AccountsReceivable.sale_id == sale_id).first()
    assert ar is not None
    assert float(ar.original_amount) == 100000.0
    assert float(ar.paid_amount) == 30000.0
    assert float(ar.balance_due) == 70000.0

    # Verify Cash Movement is strictly for the 30,000 COP initial payment
    active_reg = client.get("/cash-registers/active").json()
    movements_resp = client.get(f"/cash-registers/{active_reg['id']}/movements")
    credit_mov = next((m for m in movements_resp.json() if m["category"] == "CREDIT_PAYMENT"), None)
    assert credit_mov is not None
    assert float(credit_mov["amount"]) == 30000.0


def test_06_membership_cash_payment_creates_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create membership for Client 1 with Plan 1 (120,000 COP)
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1, "trainer_name": "Coach Pedro"})
    assert mem_resp.status_code == 201
    membership_id = mem_resp.json()["id"]

    # 2. Register CASH payment for the membership
    pay_resp = client.post("/payments/", json={"membership_id": membership_id, "payment_method": "CASH"})
    assert pay_resp.status_code == 201
    assert float(pay_resp.json()["amount"]) == 120000.0

    # 3. Verify CashMovement exists
    active_reg = client.get("/cash-registers/active").json()
    movements_resp = client.get(f"/cash-registers/{active_reg['id']}/movements")
    mem_mov = next((m for m in movements_resp.json() if m["category"] == "MEMBERSHIP_PAYMENT"), None)
    assert mem_mov is not None
    assert float(mem_mov["amount"]) == 120000.0
    assert mem_mov["type"] == "IN"


def test_07_no_duplicate_movements_on_invoice_creation():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale and complete with CASH
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})

    # Count movements before invoice
    active_reg = client.get("/cash-registers/active").json()
    movs_before = client.get(f"/cash-registers/{active_reg['id']}/movements").json()

    # Generate invoice for this sale
    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201

    # Count movements after invoice
    movs_after = client.get(f"/cash-registers/{active_reg['id']}/movements").json()
    assert len(movs_after) == len(movs_before)


def test_08_manual_income_and_expense_movements():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Register manual OUT movement (expense: e.g. Cleaning Supplies 15,000 COP)
    out_resp = client.post("/cash-registers/movements", json={
        "amount": 15000.0,
        "type": "OUT",
        "category": "MANUAL_OUT",
        "description": "Compra insumos de aseo"
    })
    assert out_resp.status_code == 201
    assert out_resp.json()["type"] == "OUT"
    assert float(out_resp.json()["amount"]) == 15000.0

    # Register manual IN movement (income: e.g. Locker Rent 10,000 COP)
    in_resp = client.post("/cash-registers/movements", json={
        "amount": 10000.0,
        "type": "IN",
        "category": "MANUAL_IN",
        "description": "Alquiler locker diario"
    })
    assert in_resp.status_code == 201
    assert in_resp.json()["type"] == "IN"
    assert float(in_resp.json()["amount"]) == 10000.0


def test_09_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Active register of Gym 1
    reg_gym1 = db.query(CashRegister).filter(CashRegister.gym_id == 1, CashRegister.status == "OPEN").first()
    assert reg_gym1 is not None

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Gym 2 active register should be 404 (none open for Gym 2 yet)
    active_resp_gym2 = client.get("/cash-registers/active")
    assert active_resp_gym2.status_code == 404

    # Gym 2 cannot get movements of Gym 1
    movs_resp = client.get(f"/cash-registers/{reg_gym1.id}/movements")
    assert len(movs_resp.json()) == 0

    # Gym 2 cannot close register of Gym 1
    close_resp = client.post(f"/cash-registers/{reg_gym1.id}/close", json={"counted_balance": 50000.0})
    assert close_resp.status_code == 400


def test_10_close_register_calculates_expected_balance_and_difference():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    reg_gym1 = db.query(CashRegister).filter(CashRegister.gym_id == 1, CashRegister.status == "OPEN").first()
    assert reg_gym1 is not None

    # Calculate expected balance manually:
    # Opening: 50,000
    # Incomes:
    #   Test 02 (Sale 1): +100,000
    #   Test 05 (Credit initial): +30,000
    #   Test 06 (Membership): +120,000
    #   Test 07 (Sale 2): +100,000
    #   Test 08 (Manual IN): +10,000
    # Total Incomes: 360,000
    # Expenses:
    #   Test 08 (Manual OUT): -15,000
    # Expected Balance: 50,000 + 360,000 - 15,000 = 395,000 COP
    
    # Close register with counted_balance = 395,000 (Exact)
    close_resp = client.post(f"/cash-registers/{reg_gym1.id}/close", json={
        "counted_balance": 395000.0,
        "closing_notes": "Cierre exacto sin novedades"
    })
    assert close_resp.status_code == 200
    data = close_resp.json()
    assert data["status"] == "CLOSED"
    assert float(data["expected_balance"]) == 395000.0
    assert float(data["counted_balance"]) == 395000.0
    assert float(data["difference"]) == 0.0

    # Verify no active register remains for Gym 1
    active_check = client.get("/cash-registers/active")
    assert active_check.status_code == 404
