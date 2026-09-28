import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch

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
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sale_integrity.db"
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
def setup_integrity_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym
    gym = Gym(id=1, name="Gym Merwil Integrity", email="merwil_integrity@gym.com", owner_id=1)
    db.add(gym)
    db.commit()

    # Subscription
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub = Subscription(gym_id=1, status=SubscriptionStatus.ACTIVE, starts_at=now, ends_at=now + timedelta(days=365), is_lifetime=True)
    db.add(sub)

    # User
    user = User(id=1, gym_id=1, full_name="Admin Integrity", email="admin@integrity.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add(user)
    db.commit()

    # Client
    c = Client(id=1, gym_id=1, full_name="Marcos Perez", document_type="CC", document="12345678", phone="3001112233", email="marcos@test.com", is_active=True)
    db.add(c)

    # Category and Products
    cat = Category(id=1, gym_id=1, name="Suplementos", is_active=True)
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Proteina Whey 2lb", sku="PROT-01", purchase_price=Decimal("80000.00"), sale_price=Decimal("120000.00"), stock=20, is_active=True)
    prod2 = Product(id=2, gym_id=1, category_id=1, name="Creatina Creapure 300g", sku="CREA-01", purchase_price=Decimal("50000.00"), sale_price=Decimal("80000.00"), stock=15, is_active=True)
    db.add_all([cat, prod1, prod2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_simulation_a_cash_sale_with_open_register_succeeds_completely():
    """SIMULATION A: Cash sale with open register -> creates sale, details, decrements stock, payment, cash movement."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Open cash register
    reg = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=Decimal("100000.00"), status="OPEN")
    db.add(reg)
    db.commit()

    initial_stock = db.query(Product).filter(Product.id == 1).first().stock
    assert initial_stock == 20

    payload = {
        "client_id": 1,
        "notes": "Venta simulación A",
        "items": [{"product_id": 1, "quantity": 2}],
        "sale_type": "CASH",
        "payment_method": "CASH"
    }

    resp = client.post("/sales/checkout", json=payload)
    assert resp.status_code == 201
    sale_data = resp.json()
    sale_id = sale_data["id"]
    assert sale_data["status"] == "COMPLETED"
    assert float(sale_data["total"]) == 240000.0

    # Verify stock decremented
    db.expire_all()
    updated_product = db.query(Product).filter(Product.id == 1).first()
    assert updated_product.stock == initial_stock - 2

    # Verify payment created
    payment = db.query(Payment).filter(Payment.sale_id == sale_id).first()
    assert payment is not None
    assert payment.payment_method == "CASH"
    assert float(payment.amount) == 240000.0

    # Verify cash movement created
    mov = db.query(CashMovement).filter(CashMovement.payment_id == payment.id).first()
    assert mov is not None
    assert float(mov.amount) == 240000.0
    assert mov.type == "IN"
    assert mov.category == "SALE"


def test_simulation_b_cash_sale_with_closed_register_fails_and_rolls_back():
    """SIMULATION B: Cash sale with closed register -> 400, stock UNCHANGED, sale NOT created, 0 details, 0 movements."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Close cash register
    reg = db.query(CashRegister).filter(CashRegister.id == 1).first()
    reg.status = "CLOSED"
    db.commit()

    initial_stock = db.query(Product).filter(Product.id == 2).first().stock
    assert initial_stock == 15
    sales_count_before = db.query(Sale).count()

    payload = {
        "client_id": 1,
        "notes": "Venta con caja cerrada",
        "items": [{"product_id": 2, "quantity": 3}],
        "sale_type": "CASH",
        "payment_method": "CASH"
    }

    resp = client.post("/sales/checkout", json=payload)
    assert resp.status_code == 400
    assert "No se puede registrar pago en efectivo sin una caja abierta" in resp.json()["detail"]

    # CRITICAL: Verify NO changes committed
    db.expire_all()
    product_after = db.query(Product).filter(Product.id == 2).first()
    assert product_after.stock == initial_stock  # Stock untouched!

    sales_count_after = db.query(Sale).count()
    assert sales_count_after == sales_count_before  # No orphan sale created!


def test_simulation_c_insufficient_stock_fails_and_rolls_back():
    """SIMULATION C: Insufficient stock -> 400, full rollback, stock unchanged, 0 sales created."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Re-open register
    reg = db.query(CashRegister).filter(CashRegister.id == 1).first()
    reg.status = "OPEN"
    db.commit()

    stock_prod1_before = db.query(Product).filter(Product.id == 1).first().stock
    sales_count_before = db.query(Sale).count()

    # Request quantity (999) exceeding stock
    payload = {
        "client_id": 1,
        "notes": "Venta stock excedido",
        "items": [{"product_id": 1, "quantity": 999}],
        "sale_type": "CASH",
        "payment_method": "CASH"
    }

    resp = client.post("/sales/checkout", json=payload)
    assert resp.status_code == 400
    assert "Stock insuficiente" in resp.json()["detail"]

    db.expire_all()
    stock_prod1_after = db.query(Product).filter(Product.id == 1).first().stock
    assert stock_prod1_after == stock_prod1_before
    assert db.query(Sale).count() == sales_count_before


def test_simulation_d_error_during_payment_step_rolls_back_everything():
    """SIMULATION D: Error during payment creation -> Full rollback, stock unchanged, 0 sales created."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    initial_stock = db.query(Product).filter(Product.id == 2).first().stock
    sales_count_before = db.query(Sale).count()

    # Mock Payment instantiation to raise an unexpected runtime error
    with patch("app.models.payment.Payment.__init__", side_effect=RuntimeError("Simulated payment gateway crash")):
        payload = {
            "client_id": 1,
            "notes": "Fallo simulado en payment",
            "items": [{"product_id": 2, "quantity": 2}],
            "sale_type": "CASH",
            "payment_method": "CARD"
        }
        with pytest.raises(RuntimeError):
            from app.services.sale_service import SaleService
            from app.schemas.sale import SaleCheckoutRequest
            req = SaleCheckoutRequest(**payload)
            SaleService.checkout(db, current_test_user, req)

    # Verify atomic rollback
    db.expire_all()
    assert db.query(Product).filter(Product.id == 2).first().stock == initial_stock
    assert db.query(Sale).count() == sales_count_before


def test_simulation_e_error_during_cash_movement_rolls_back_everything():
    """SIMULATION E: Error during CashMovement creation -> Full rollback, stock unchanged, 0 sales created."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    initial_stock = db.query(Product).filter(Product.id == 2).first().stock
    sales_count_before = db.query(Sale).count()

    # Mock CashRegisterService.add_movement to fail
    with patch("app.services.cash_register_service.CashRegisterService.add_movement", side_effect=Exception("Database lock on movements table")):
        payload = {
            "client_id": 1,
            "notes": "Fallo simulado en movimiento de caja",
            "items": [{"product_id": 2, "quantity": 1}],
            "sale_type": "CASH",
            "payment_method": "CASH"
        }
        with pytest.raises(Exception):
            from app.services.sale_service import SaleService
            from app.schemas.sale import SaleCheckoutRequest
            req = SaleCheckoutRequest(**payload)
            SaleService.checkout(db, current_test_user, req)

    # Verify atomic rollback
    db.expire_all()
    assert db.query(Product).filter(Product.id == 2).first().stock == initial_stock
    assert db.query(Sale).count() == sales_count_before


def test_simulation_f_completed_sale_duplicate_prevention():
    """SIMULATION F: Attempting to re-complete an already completed sale raises error without creating duplicate movements."""
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Get the sale from simulation A
    completed_sale = db.query(Sale).filter(Sale.status == "COMPLETED").first()
    assert completed_sale is not None

    movements_count_before = db.query(CashMovement).count()

    # Attempt to complete again
    resp = client.post(f"/sales/{completed_sale.id}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})
    assert resp.status_code == 400
    assert "already completed" in resp.json()["detail"].lower()

    # Verify no new movement created
    movements_count_after = db.query(CashMovement).count()
    assert movements_count_after == movements_count_before
