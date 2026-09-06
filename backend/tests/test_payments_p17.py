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

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_payments_p17.db"
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
def setup_payments_db():
    from app.database.base import Base
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
    user1 = User(id=1, gym_id=1, full_name="Admin Alpha", email="admin@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Categories & Products
    cat1 = Category(id=1, gym_id=1, name="Suplementos", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="Snacks", is_active=True)
    db.add_all([cat1, cat2])

    prod1 = Product(id=1, gym_id=1, category_id=1, name="Creatina Creapure", sku="CREA-01", purchase_price=50000.0, sale_price=100000.0, stock=20, minimum_stock=5, is_active=True)
    prod2 = Product(id=2, gym_id=1, category_id=1, name="Proteina Whey", sku="WHEY-01", purchase_price=80000.0, sale_price=150000.0, stock=10, minimum_stock=2, is_active=True)
    prod_beta = Product(id=3, gym_id=2, category_id=2, name="Barra Energetica", sku="BAR-02", purchase_price=3000.0, sale_price=6000.0, stock=30, minimum_stock=5, is_active=True)
    db.add_all([prod1, prod2, prod_beta])

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Santiago Ruiz", document_type="CC", document="50505", phone="3005050505", is_active=True)
    client2 = Client(id=2, gym_id=1, full_name="Valentina Rios", document_type="CC", document="60606", phone="3006060606", is_active=True)
    client_beta = Client(id=3, gym_id=2, full_name="Mateo Gomez", document_type="CC", document="70707", phone="3007070707", is_active=True)
    db.add_all([client1, client2, client_beta])

    # Membership Plans
    plan1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual VIP", price=120000.0, duration_days=30, is_active=True)
    plan_beta = MembershipPlan(id=2, gym_id=2, name="Plan Beta Mensual", price=130000.0, duration_days=30, is_active=True)
    db.add_all([plan1, plan_beta])

    # Cash Registers
    cash_reg1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=50000.0, status="OPEN")
    cash_reg2 = CashRegister(id=2, gym_id=2, opened_by=2, opening_balance=50000.0, status="OPEN")
    db.add_all([cash_reg1, cash_reg2])

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_transfer_sale_creates_payment():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale with TRANSFER: 1 unit of Creatina @ 100,000 COP
    sale_resp = client.post("/sales/", json={"client_id": 1})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})
    assert complete_resp.status_code == 200

    # Verify Payment record
    payment = db.query(Payment).filter(Payment.sale_id == sale_id).first()
    assert payment is not None
    assert payment.payment_method == "TRANSFER"
    assert float(payment.amount) == 100000.0
    assert payment.status == "PAID"
    assert payment.gym_id == 1


def test_02_transfer_sale_does_not_create_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Get active cash register movements
    active_reg = client.get("/cash-registers/active").json()
    movements_resp = client.get(f"/cash-registers/{active_reg['id']}/movements")
    assert movements_resp.status_code == 200
    movements = movements_resp.json()

    # Verify NO CashMovement exists for the transfer sale
    payment = db.query(Payment).filter(Payment.payment_method == "TRANSFER").first()
    assert payment is not None
    transfer_mov = next((m for m in movements if m.get("payment_id") == payment.id), None)
    assert transfer_mov is None


def test_03_transfer_sale_updates_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Product 1 started with stock = 20, sold 1 unit in test_01
    prod = db.query(Product).filter(Product.id == 1).first()
    assert prod.stock == 19


def test_04_transfer_membership_payment_creates_payment():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create Membership for Client 1 with Plan 1 (120,000 COP)
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1})
    assert mem_resp.status_code == 201
    mem_id = mem_resp.json()["id"]

    # Register full payment with TRANSFER
    pay_resp = client.post("/payments/", json={
        "membership_id": mem_id,
        "amount": 120000.0,
        "payment_method": "TRANSFER",
        "reference": "BANCOLOMBIA-TRF-987654"
    })
    assert pay_resp.status_code == 201
    pay_data = pay_resp.json()
    assert float(pay_data["amount"]) == 120000.0
    assert pay_data["payment_method"] == "TRANSFER"
    assert pay_data["reference"] == "BANCOLOMBIA-TRF-987654"
    assert pay_data["status"] == "PAID"


def test_05_transfer_membership_payment_does_not_create_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payment = db.query(Payment).filter(Payment.reference == "BANCOLOMBIA-TRF-987654").first()
    assert payment is not None

    cash_mov = db.query(CashMovement).filter(CashMovement.payment_id == payment.id).first()
    assert cash_mov is None


def test_06_transfer_partial_membership_payment_preserves_balance():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create membership for Client 2 with Plan 1 (120,000 COP)
    mem_resp = client.post("/memberships/", json={"client_id": 2, "membership_plan_id": 1})
    assert mem_resp.status_code == 201
    mem_id = mem_resp.json()["id"]

    # Partial payment 1: 50,000 COP with TRANSFER
    p1_resp = client.post("/payments/", json={
        "membership_id": mem_id,
        "amount": 50000.0,
        "payment_method": "TRANSFER"
    })
    assert p1_resp.status_code == 201
    assert float(p1_resp.json()["amount"]) == 50000.0

    # Remaining balance should be 70,000 COP. Pay remaining 70,000 with CASH
    p2_resp = client.post("/payments/", json={
        "membership_id": mem_id,
        "amount": 70000.0,
        "payment_method": "CASH"
    })
    assert p2_resp.status_code == 201

    # Verify: Transfer has NO cash movement, Cash has 1 cash movement (+70,000)
    p1_payment = db.query(Payment).filter(Payment.id == p1_resp.json()["id"]).first()
    p2_payment = db.query(Payment).filter(Payment.id == p2_resp.json()["id"]).first()

    assert db.query(CashMovement).filter(CashMovement.payment_id == p1_payment.id).first() is None
    p2_mov = db.query(CashMovement).filter(CashMovement.payment_id == p2_payment.id).first()
    assert p2_mov is not None
    assert float(p2_mov.amount) == 70000.0
    assert p2_mov.type == "IN"


def test_07_transfer_overpayment_is_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create membership for Client 1 (Plan 1: 120,000 COP)
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1})
    mem_id = mem_resp.json()["id"]

    # Attempt to pay 150,000 COP with TRANSFER on 120,000 balance
    overpay_resp = client.post("/payments/", json={
        "membership_id": mem_id,
        "amount": 150000.0,
        "payment_method": "TRANSFER"
    })
    assert overpay_resp.status_code == 400
    assert "no puede superar el saldo pendiente" in overpay_resp.json()["detail"]


def test_08_transfer_does_not_change_physical_cash_balance():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Query active cash register
    active_reg = client.get("/cash-registers/active").json()
    movements_before = client.get(f"/cash-registers/{active_reg['id']}/movements").json()
    incomes_before = sum(float(m["amount"]) for m in movements_before if m["type"] == "IN")

    # Perform sale with TRANSFER
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 1})
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})
    assert complete_resp.status_code == 200

    # Query movements after TRANSFER sale
    movements_after = client.get(f"/cash-registers/{active_reg['id']}/movements").json()
    incomes_after = sum(float(m["amount"]) for m in movements_after if m["type"] == "IN")

    # Physical cash incomes in register did not change
    assert incomes_after == incomes_before


def test_09_multi_tenant_transfer_payment_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Create membership in Gym 1
    current_test_user = db.query(User).filter(User.id == 1).first()
    mem_resp = client.post("/memberships/", json={"client_id": 1, "membership_plan_id": 1})
    mem_id_gym1 = mem_resp.json()["id"]

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to pay Gym 1's membership via TRANSFER
    pay_resp = client.post("/payments/", json={
        "membership_id": mem_id_gym1,
        "amount": 120000.0,
        "payment_method": "TRANSFER"
    })
    assert pay_resp.status_code == 404


def test_10_invoice_creation_does_not_duplicate_transfer_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale and complete with TRANSFER
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 1})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})

    # Count cash movements before invoice
    active_reg = client.get("/cash-registers/active").json()
    movs_before = client.get(f"/cash-registers/{active_reg['id']}/movements").json()

    # Generate invoice for the TRANSFER sale
    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201

    # Count cash movements after invoice
    movs_after = client.get(f"/cash-registers/{active_reg['id']}/movements").json()
    assert len(movs_after) == len(movs_before)


def test_11_explicit_cash_vs_transfer_comparison():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Sale 1: CASH for 100,000 COP
    s1 = client.post("/sales/", json={"client_id": 1}).json()["id"]
    client.post("/sale-details/", json={"sale_id": s1, "product_id": 1, "quantity": 1})
    client.post(f"/sales/{s1}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})

    # Sale 2: TRANSFER for 100,000 COP
    s2 = client.post("/sales/", json={"client_id": 1}).json()["id"]
    client.post("/sale-details/", json={"sale_id": s2, "product_id": 1, "quantity": 1})
    client.post(f"/sales/{s2}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})

    # Verify Payments
    p1 = db.query(Payment).filter(Payment.sale_id == s1).first()
    p2 = db.query(Payment).filter(Payment.sale_id == s2).first()

    assert p1.payment_method == "CASH"
    assert p2.payment_method == "TRANSFER"

    # Verify CashMovements: p1 HAS movement, p2 DOES NOT
    mov1 = db.query(CashMovement).filter(CashMovement.payment_id == p1.id).first()
    mov2 = db.query(CashMovement).filter(CashMovement.payment_id == p2.id).first()

    assert mov1 is not None
    assert float(mov1.amount) == 100000.0
    assert mov2 is None
