import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone, date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.gym import Gym
from app.models.product import Product
from app.models.category import Category
from app.models.inventory_movement import InventoryMovement
from app.models.audit_log import AuditLog
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from app.constants.inventory_movement_types import InventoryMovementType
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_modules_p24.db"
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
def setup_modules_p24_db():
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

    # Categories for Gym 1 & 2
    cat1 = Category(id=1, gym_id=1, name="General Alpha", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="General Beta", is_active=True)
    db.add_all([cat1, cat2])
    db.commit()

    # Products for Gym 1 & 2
    prod1 = Product(id=1, gym_id=1, category_id=1, name="Proteina Whey", sku="SKU001", purchase_price=Decimal("80000.00"), sale_price=Decimal("120000.00"), stock=10, minimum_stock=5, is_active=True)
    prod2 = Product(id=2, gym_id=2, category_id=2, name="Creatina Beta", sku="SKU002", purchase_price=Decimal("60000.00"), sale_price=Decimal("90000.00"), stock=15, minimum_stock=3, is_active=True)
    db.add_all([prod1, prod2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


# =========================================================================
# CATEGORIES TESTS
# =========================================================================

def test_01_create_category():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "name": "Suplementos",
        "description": "Proteinas y aminoacidos"
    }
    resp = client.post("/categories/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Suplementos"
    assert data["gym_id"] == 1


def test_02_get_categories_list():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp = client.get("/categories/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    assert any(c["name"] == "Suplementos" for c in data["items"])


def test_03_update_and_delete_category():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Update
    resp = client.put("/categories/1", json={"name": "Nutrición Deportiva"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Nutrición Deportiva"

    # Delete
    del_resp = client.delete("/categories/1")
    assert del_resp.status_code == 204

    # Verify category is inactive
    cat = db.query(Category).filter(Category.id == 1).first()
    assert cat.is_active is False


def test_04_categories_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 2 user
    current_test_user = db.query(User).filter(User.id == 2).first()
    
    # Gym 2 creates category
    resp = client.post("/categories/", json={"name": "Bebidas"})
    assert resp.status_code == 201
    cat2_id = resp.json()["id"]

    # Switch to Gym 1 user
    current_test_user = db.query(User).filter(User.id == 1).first()
    
    # Gym 1 cannot get or modify Gym 2 category
    resp_get = client.get(f"/categories/{cat2_id}")
    assert resp_get.status_code == 404

    resp_put = client.put(f"/categories/{cat2_id}", json={"name": "Hacked"})
    assert resp_put.status_code == 404


# =========================================================================
# INVENTORY MOVEMENTS TESTS
# =========================================================================

def test_05_create_inventory_movement_in_increases_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "product_id": 1,
        "movement_type": "IN",
        "quantity": 5,
        "reason": "Compra de inventario adicional"
    }
    resp = client.post("/inventory-movements/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["stock_before"] == 10
    assert data["stock_after"] == 15

    # Verify product stock updated
    prod = db.query(Product).filter(Product.id == 1).first()
    assert prod.stock == 15


def test_06_create_inventory_movement_out_decreases_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "product_id": 1,
        "movement_type": "OUT",
        "quantity": 3,
        "reason": "Muestra comercial"
    }
    resp = client.post("/inventory-movements/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["stock_before"] == 15
    assert data["stock_after"] == 12

    prod = db.query(Product).filter(Product.id == 1).first()
    assert prod.stock == 12


def test_07_inventory_movement_out_insufficient_stock_rejected():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "product_id": 1,
        "movement_type": "OUT",
        "quantity": 999,
        "reason": "Intento de salida excesiva"
    }
    resp = client.post("/inventory-movements/", json=payload)
    assert resp.status_code in [400, 422]


def test_08_inventory_movement_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 1 user tries to move Gym 2 product (id=2)
    current_test_user = db.query(User).filter(User.id == 1).first()
    payload = {
        "product_id": 2,
        "movement_type": "IN",
        "quantity": 10,
        "reason": "Unauthorized foreign move"
    }
    resp = client.post("/inventory-movements/", json=payload)
    assert resp.status_code == 404


# =========================================================================
# AUDIT LOGS TESTS
# =========================================================================

def test_09_audit_logs_listing_and_filtering():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create audit log entry directly
    from app.services.audit_service import AuditService
    AuditService.log(
        db=db,
        gym_id=1,
        action="USER_CREATED",
        entity_type="User",
        user_id=1,
        entity_id=10,
        new_values={"full_name": "Nuevo Empleado"}
    )
    db.commit()

    resp = client.get("/audit-logs/?action=USER_CREATED")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) >= 1
    assert data["items"][0]["action"] == "USER_CREATED"
    assert data["items"][0]["entity_type"] == "User"


def test_10_audit_logs_multi_tenant_isolation():
    global current_test_user
    db = TestingSessionLocal()

    # Gym 2 user queries audit logs
    current_test_user = db.query(User).filter(User.id == 2).first()
    resp = client.get("/audit-logs/")
    assert resp.status_code == 200
    data = resp.json()
    # Gym 2 shouldn't see Gym 1 logs
    for item in data["items"]:
        assert item["gym_id"] == 2


# =========================================================================
# REPORTS TESTS
# =========================================================================

def test_11_reports_sales_and_low_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    resp_sales = client.get("/reports/sales")
    assert resp_sales.status_code == 200
    assert "total_sales" in resp_sales.json()
    assert "total_income" in resp_sales.json()

    resp_low_stock = client.get("/reports/low-stock")
    assert resp_low_stock.status_code == 200
    assert isinstance(resp_low_stock.json(), list)
