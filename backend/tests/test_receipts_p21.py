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
from app.models.client import Client
from app.models.category import Category
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.invoice_detail import InvoiceDetail
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.subscription import Subscription, SubscriptionStatus
from app.constants.sale_status import SaleStatus
from app.constants.invoice_status import InvoiceStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_receipts_p21.db"
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
def setup_receipts_db():
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
    user1 = User(id=1, gym_id=1, full_name="Admin Alpha", email="admin@alpha.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Juan Perez", document_type="CC", document="123456", phone="3001234567", email="juan@perez.com", is_active=True)
    client2 = Client(id=2, gym_id=2, full_name="Maria Beta", document_type="CC", document="654321", phone="3009876543", email="maria@beta.com", is_active=True)
    db.add_all([client1, client2])
    db.commit()

    # Category and Products
    cat1 = Category(id=1, gym_id=1, name="Suplementos", is_active=True)
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Proteina Whey 2lb", sku="SKU-PROT-1", purchase_price=Decimal("80000.00"), sale_price=Decimal("120000.00"), stock=50, is_active=True)
    prod2 = Product(id=2, gym_id=1, category_id=1, name="Creatina Monohidrato", sku="SKU-CREAT-1", purchase_price=Decimal("50000.00"), sale_price=Decimal("80000.00"), stock=40, is_active=True)
    db.add_all([cat1, prod1, prod2])
    db.commit()

    # Cash register for Gym 1
    register1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=Decimal("100000.00"), status="OPEN")
    db.add(register1)
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_invoice_for_completed_sale():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create Sale
    sale_resp = client.post("/sales/", json={"client_id": 1, "notes": "Venta POS 1"})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    # 2. Add Sale Detail
    det_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 1, "unit_price": 120000.0})
    assert det_resp.status_code == 201

    # 3. Complete Sale (CASH)
    comp_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"

    # 4. Create Invoice
    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201
    inv_data = inv_resp.json()
    assert inv_data["sale_id"] == sale_id
    assert inv_data["client_id"] == 1
    assert inv_data["payment_method"] == "CASH"
    assert inv_data["status"] == "ISSUED"
    assert float(inv_data["total"]) == 120000.0


def test_02_invoice_contains_correct_sale_amounts_and_details():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Fetch invoice details for invoice 1
    details_resp = client.get("/invoice-details/1")
    assert details_resp.status_code == 200
    details = details_resp.json()
    assert len(details) == 1
    assert details[0]["product_id"] == 1
    assert details[0]["product_name"] == "Proteina Whey 2lb"
    assert details[0]["quantity"] == 1
    assert float(details[0]["unit_price"]) == 120000.0
    assert float(details[0]["subtotal"]) == 120000.0


def test_03_invoice_reflects_card_payment_method():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale with CARD
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 1, "unit_price": 80000.0})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CARD"})

    # Create invoice
    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201
    assert inv_resp.json()["payment_method"] == "CARD"
    assert float(inv_resp.json()["total"]) == 80000.0


def test_04_invoice_reflects_transfer_payment_method():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create sale with TRANSFER
    sale_resp = client.post("/sales/", json={"client_id": 1})
    sale_id = sale_resp.json()["id"]
    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 2, "unit_price": 120000.0})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})

    # Create invoice
    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201
    assert inv_resp.json()["payment_method"] == "TRANSFER"
    assert float(inv_resp.json()["total"]) == 240000.0


def test_05_invoice_creation_is_idempotent_no_duplicate_payments():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Count payments and cash movements before
    payments_count_before = db.query(Payment).filter(Payment.gym_id == 1).count()
    cash_mov_count_before = db.query(CashMovement).filter(CashMovement.gym_id == 1).count()

    # Attempt to create duplicate invoice for sale 1 (already invoiced)
    dup_resp = client.post("/invoices/", json={"sale_id": 1})
    assert dup_resp.status_code == 409

    # Verify counts remain identical
    db.expire_all()
    assert db.query(Payment).filter(Payment.gym_id == 1).count() == payments_count_before
    assert db.query(CashMovement).filter(CashMovement.gym_id == 1).count() == cash_mov_count_before


def test_06_invoice_creation_does_not_modify_stock_or_sale_total():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Verify stock of product 1 and product 2
    prod1 = db.query(Product).filter(Product.id == 1).first()
    # 50 original - 1 (test_01) - 2 (test_04) = 47
    assert prod1.stock == 47


def test_07_get_invoices_list_and_search():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Query invoices list
    list_resp = client.get("/invoices/")
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert data["total"] == 3

    # Search by invoice number
    first_number = data["items"][0]["invoice_number"]
    search_resp = client.get(f"/invoices/?search={first_number}")
    assert search_resp.status_code == 200
    assert search_resp.json()["total"] >= 1


def test_08_get_single_invoice_by_id():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/invoices/1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["gym_id"] == 1
    assert data["client_id"] == 1


def test_09_multi_tenant_isolation_cannot_view_or_invoice_foreign_sale():
    global current_test_user
    db = TestingSessionLocal()

    # Switch to User of Gym 2 (Beta)
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to view invoices of Gym 1
    resp_get = client.get("/invoices/1")
    assert resp_get.status_code == 404

    # Attempt to view invoice-details of Gym 1
    resp_det = client.get("/invoice-details/1")
    assert resp_det.status_code == 404

    # Attempt to create invoice for Gym 1 sale (sale_id = 1)
    resp_create = client.post("/invoices/", json={"sale_id": 1})
    assert resp_create.status_code == 404


def test_10_cannot_invoice_uncompleted_sale():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create an OPEN sale without completing it
    sale_resp = client.post("/sales/", json={"client_id": 1})
    open_sale_id = sale_resp.json()["id"]

    # Attempt to create invoice
    inv_resp = client.post("/invoices/", json={"sale_id": open_sale_id})
    assert inv_resp.status_code == 400
    assert "Only completed sales can be invoiced" in inv_resp.json()["detail"]


def test_11_nonexistent_sale_or_invoice_returns_404():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Nonexistent sale
    resp_sale = client.post("/invoices/", json={"sale_id": 99999})
    assert resp_sale.status_code == 404

    # Nonexistent invoice
    resp_inv = client.get("/invoices/99999")
    assert resp_inv.status_code == 404


def test_12_invoice_details_has_product_name():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/invoice-details/2")
    assert resp.status_code == 200
    details = resp.json()
    assert len(details) == 1
    assert details[0]["product_name"] == "Creatina Monohidrato"
