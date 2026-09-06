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
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.cash_register import CashRegister
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sales_p14.db"
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
def setup_sales_db():
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

    # Categories
    cat1 = Category(id=1, gym_id=1, name="Bebidas", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="Snacks", is_active=True)
    db.add_all([cat1, cat2])

    # Products
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Agua 500ml", sku="AGUA-01", purchase_price=1000.0, sale_price=2000.0, stock=20, minimum_stock=5, is_active=True)
    prod2 = Product(id=2, gym_id=1, category_id=1, name="Gatorade 500ml", sku="GAT-01", purchase_price=2500.0, sale_price=5000.0, stock=10, minimum_stock=3, is_active=True)
    prod_beta = Product(id=3, gym_id=2, category_id=2, name="Barra Proteica", sku="BAR-01", purchase_price=3000.0, sale_price=6000.0, stock=15, minimum_stock=2, is_active=True)
    db.add_all([prod1, prod2, prod_beta])

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Carlos Cliente", document_type="CC", document="11111", phone="3001111111", is_active=True)
    client2 = Client(id=2, gym_id=2, full_name="Diana Cliente", document_type="CC", document="22222", phone="3002222222", is_active=True)
    db.add_all([client1, client2])

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


def test_01_create_sale_with_single_product():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create Sale header
    sale_resp = client.post("/sales/", json={"client_id": 1, "notes": "Venta prueba 1"})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    # 2. Add product detail (2 units of Agua @ 2000)
    detail_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 2})
    assert detail_resp.status_code == 201
    assert float(detail_resp.json()["unit_price"]) == 2000.0
    assert float(detail_resp.json()["subtotal"]) == 4000.0

    # 3. Complete sale with CARD
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CARD"})
    assert complete_resp.status_code == 200
    completed_data = complete_resp.json()
    assert completed_data["status"] == "COMPLETED"
    assert float(completed_data["total"]) == 4000.0

    # 4. Check product stock reduced from 20 to 18
    p1 = db.query(Product).filter(Product.id == 1).first()
    db.refresh(p1)
    assert p1.stock == 18


def test_02_create_sale_with_multiple_products():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create Sale
    sale_resp = client.post("/sales/", json={"client_id": 1})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    # 2. Add Detail 1: 3 units of Agua (stock 18) @ 2000 -> 6000
    d1_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 3})
    assert d1_resp.status_code == 201

    # 3. Add Detail 2: 2 units of Gatorade (stock 10) @ 5000 -> 10000
    d2_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 2})
    assert d2_resp.status_code == 201

    # 4. Complete sale with CASH
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert complete_resp.status_code == 200
    assert float(complete_resp.json()["total"]) == 16000.0

    # 5. Check stocks: Agua: 18 - 3 = 15, Gatorade: 10 - 2 = 8
    p1 = db.query(Product).filter(Product.id == 1).first()
    p2 = db.query(Product).filter(Product.id == 2).first()
    db.refresh(p1)
    db.refresh(p2)
    assert p1.stock == 15
    assert p2.stock == 8


def test_03_calculate_sale_total():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1}) # 2000
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 1}) # 5000

    get_sale_resp = client.get(f"/sales/{sale_id}")
    assert get_sale_resp.status_code == 200
    assert float(get_sale_resp.json()["total"]) == 7000.0


def test_04_cannot_sell_more_than_available_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Product 2 (Gatorade) currently has stock = 7 (after test 3 added 1, so stock is 7)
    p2 = db.query(Product).filter(Product.id == 2).first()
    db.refresh(p2)
    current_stock = p2.stock

    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    # Attempt to sell current_stock + 5
    excess_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": current_stock + 5})
    assert excess_resp.status_code in (400, 422)

    # Verify stock remained untouched
    db.refresh(p2)
    assert p2.stock == current_stock


def test_05_cannot_complete_sale_with_empty_items():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    # Attempt complete without adding any items
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert complete_resp.status_code in (400, 422)


def test_06_counter_cash_sale_without_registered_client():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale without client_id
    sale_resp = client.post("/sales/", json={"client_id": None, "notes": "Venta mostrador anónima"})
    assert sale_resp.status_code == 201
    sale_data = sale_resp.json()
    assert sale_data["client_id"] is None
    sale_id = sale_data["id"]

    # Add product
    d_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    assert d_resp.status_code == 201

    # Complete cash sale
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"


def test_07_sale_preserves_historical_unit_price():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Sell product 1 @ 2000
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    d_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 2})
    detail_id = d_resp.json()["id"]

    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CARD"})

    # Now change product 1 price to 3500
    client.put("/products/1", json={"sale_price": 3500.0})

    # Retrieve past sale detail and past sale total
    sale_detail_resp = client.get(f"/sale-details/{detail_id}")
    assert sale_detail_resp.status_code == 200
    assert float(sale_detail_resp.json()["unit_price"]) == 2000.0
    assert float(sale_detail_resp.json()["subtotal"]) == 4000.0

    past_sale_resp = client.get(f"/sales/{sale_id}")
    assert past_sale_resp.status_code == 200
    assert float(past_sale_resp.json()["total"]) == 4000.0


def test_08_payment_method_is_persisted():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})

    # Verify payment in DB
    payment = db.query(Payment).filter(Payment.sale_id == sale_id).first()
    assert payment is not None
    assert payment.payment_method == "TRANSFER"
    assert float(payment.amount) == 3500.0 # product 1 was changed to 3500 in test 7
    assert payment.status == "PAID"


def test_09_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to create sale in Gym 2 referencing Product 1 of Gym 1
    sale_resp = client.post("/sales/", json={"client_id": 2})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    # Adding product 1 (Gym 1) should be rejected 404
    detail_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1})
    assert detail_resp.status_code == 404

    # Adding product 3 (Gym 2) succeeds
    detail_ok = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 3, "quantity": 1})
    assert detail_ok.status_code == 201


def test_10_credit_sale_creates_accounts_receivable():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 2}) # 2 * 3500 = 7000

    # Complete as credit with initial payment of 2000
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={
        "sale_type": "CREDIT",
        "payment_method": "CASH",
        "due_date": "2026-09-30T00:00:00",
        "initial_payment": 2000.0
    })
    assert complete_resp.status_code == 200

    # Verify AccountsReceivable in DB
    from app.models.accounts_receivable import AccountsReceivable
    ar = db.query(AccountsReceivable).filter(AccountsReceivable.sale_id == sale_id).first()
    assert ar is not None
    assert float(ar.original_amount) == 7000.0
    assert float(ar.paid_amount) == 2000.0
    assert float(ar.balance_due) == 5000.0
    assert ar.status == "PARTIAL"
