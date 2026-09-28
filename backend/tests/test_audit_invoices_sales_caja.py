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
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_audit_invoices_sales_caja.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
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


@pytest.fixture(scope="module", autouse=True)
def setup_audit_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Merwil Audit 1", email="merwil1@gym.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Merwil Audit 2", email="merwil2@gym.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    # Subscriptions
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    sub2 = Subscription(gym_id=2, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add_all([sub1, sub2])

    # Users
    user1 = User(id=1, gym_id=1, full_name="Admin Audit", email="admin@audit.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Admin Beta", email="admin@beta.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Clients
    client1 = Client(id=1, gym_id=1, full_name="Carlos Gomez", document_type="CC", document="1098765432", phone="3109876543", email="carlos@test.com", is_active=True)
    client2 = Client(id=2, gym_id=2, full_name="Laura Beta", document_type="CC", document="9876543210", phone="3209876543", email="laura@beta.com", is_active=True)
    db.add_all([client1, client2])
    db.commit()

    # Category and Products
    cat1 = Category(id=1, gym_id=1, name="Bebidas", is_active=True)
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Agua Cristal 600ml", sku="SKU-AGUA-1", purchase_price=Decimal("1500.00"), sale_price=Decimal("3000.00"), stock=100, is_active=True)
    prod2 = Product(id=2, gym_id=1, category_id=1, name="Gatorade 500ml", sku="SKU-GAT-1", purchase_price=Decimal("3500.00"), sale_price=Decimal("6000.00"), stock=50, is_active=True)
    db.add_all([cat1, prod1, prod2])
    db.commit()

    # Open Cash register for Gym 1
    register1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=Decimal("50000.00"), status="OPEN")
    db.add(register1)
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_cash_sale_creates_cash_movement_and_updates_summary():
    """Verify that a CASH sale automatically creates a CashMovement and registers in the active shift."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Create Sale
    sale_resp = client.post("/sales/", json={"client_id": 1, "notes": "Venta efectivo con cliente"})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    # 2. Add Detail (2 Aguas = 6,000)
    detail_resp = client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 1, "quantity": 2, "unit_price": 3000.0})
    assert detail_resp.status_code == 201

    # 3. Complete Sale (CASH)
    complete_resp = client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert complete_resp.status_code == 200
    assert complete_resp.json()["status"] == "COMPLETED"

    # 4. Verify CashMovement in DB
    movement = db.query(CashMovement).filter(
        CashMovement.cash_register_id == 1,
        CashMovement.category == "SALE",
        CashMovement.type == "IN",
    ).first()
    assert movement is not None
    assert float(movement.amount) == 6000.0
    assert movement.gym_id == 1
    assert movement.payment_id is not None

    # 5. Verify Movements endpoint
    movements_resp = client.get("/cash-registers/1/movements")
    assert movements_resp.status_code == 200
    mov_list = movements_resp.json()
    assert len(mov_list) >= 1
    sale_mov = [m for m in mov_list if m["category"] == "SALE"][0]
    assert float(sale_mov["amount"]) == 6000.0


def test_02_invoice_creation_embeds_client_name_and_document():
    """Verify that InvoiceResponse includes client_name, client_document, and client_phone."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    sale = db.query(Sale).filter(Sale.client_id == 1).first()
    assert sale is not None

    # Create invoice for this sale
    inv_resp = client.post("/invoices/", json={"sale_id": sale.id})
    assert inv_resp.status_code == 201
    inv_data = inv_resp.json()

    # CRITICAL: Verify client fields are populated directly on the response
    assert inv_data["client_id"] == 1
    assert inv_data["client_name"] == "Carlos Gomez"
    assert inv_data["client_document"] == "1098765432"
    assert inv_data["client_phone"] == "3109876543"
    assert inv_data["payment_method"] == "CASH"
    assert float(inv_data["total"]) == 6000.0


def test_03_get_invoices_list_includes_client_details_without_client_query():
    """Verify that GET /invoices/ returns client_name and document for all items."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/invoices/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    first_inv = data["items"][0]
    assert first_inv["client_name"] == "Carlos Gomez"
    assert first_inv["client_document"] == "1098765432"
    assert first_inv["client_phone"] == "3109876543"


def test_04_anonymous_sale_invoice_has_null_client():
    """Verify that an invoice for an anonymous sale (client_id=None) returns null for client fields."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # 1. Anonymous sale
    sale_resp = client.post("/sales/", json={"client_id": None, "notes": "Venta mostrador"})
    assert sale_resp.status_code == 201
    sale_id = sale_resp.json()["id"]

    client.post("/sale-details/", json={"sale_id": sale_id, "product_id": 2, "quantity": 1, "unit_price": 6000.0})
    client.post(f"/sales/{sale_id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})

    inv_resp = client.post("/invoices/", json={"sale_id": sale_id})
    assert inv_resp.status_code == 201
    inv_data = inv_resp.json()

    assert inv_data["client_id"] is None
    assert inv_data["client_name"] is None
    assert inv_data["client_document"] is None
    assert inv_data["client_phone"] is None


def test_05_multi_tenant_isolation_on_invoices():
    """Verify that Gym 2 cannot view or access Gym 1's invoices."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    resp = client.get("/invoices/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert len(data["items"]) == 0
