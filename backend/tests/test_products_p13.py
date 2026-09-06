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
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_products_p13.db"
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
def setup_products_db():
    from app.database.base import Base
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gym 1 & Gym 2
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
    user1 = User(id=1, gym_id=1, full_name="Owner Uno", email="owner1@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    user2 = User(id=2, gym_id=2, full_name="Owner Dos", email="owner2@gym.com", password=hash_password("Pass1234"), role="OWNER", is_active=True)
    db.add_all([user1, user2])
    db.commit()

    # Categories
    cat1 = Category(id=1, gym_id=1, name="Bebidas", is_active=True)
    cat2 = Category(id=2, gym_id=2, name="Suplementos", is_active=True)
    db.add_all([cat1, cat2])
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_create_product_with_price_and_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    payload = {
        "category_id": 1,
        "name": "Bebida Energética 500ml",
        "description": "Bebida con electrolitos",
        "sku": "NRG-500",
        "purchase_price": 30000.0,
        "sale_price": 50000.0,
        "stock": 20,
        "minimum_stock": 5
    }
    response = client.post("/products/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert float(data["purchase_price"]) == 30000.0
    assert float(data["sale_price"]) == 50000.0
    assert data["stock"] == 20
    assert data["minimum_stock"] == 5
    assert data["gym_id"] == 1


def test_02_get_product_and_verify_initial_values():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    response = client.get(f"/products/{product.id}")
    assert response.status_code == 200
    data = response.json()
    assert float(data["purchase_price"]) == 30000.0
    assert float(data["sale_price"]) == 50000.0
    assert data["stock"] == 20
    assert data["minimum_stock"] == 5


def test_03_edit_only_name_preserves_price_and_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "name": "Bebida Energética Plus 500ml"
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Bebida Energética Plus 500ml"
    assert float(data["purchase_price"]) == 30000.0
    assert float(data["sale_price"]) == 50000.0
    assert data["stock"] == 20
    assert data["minimum_stock"] == 5

    # Verify persistence in DB
    db.refresh(product)
    assert product.name == "Bebida Energética Plus 500ml"
    assert float(product.purchase_price) == 30000.0
    assert float(product.sale_price) == 50000.0
    assert product.stock == 20


def test_04_edit_only_price_preserves_stock():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "purchase_price": 35000.0,
        "sale_price": 60000.0
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert float(data["purchase_price"]) == 35000.0
    assert float(data["sale_price"]) == 60000.0
    assert data["stock"] == 20

    # Verify persistence in DB
    db.refresh(product)
    assert float(product.purchase_price) == 35000.0
    assert float(product.sale_price) == 60000.0
    assert product.stock == 20


def test_05_edit_only_stock_preserves_price():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "stock": 15,
        "minimum_stock": 3
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert float(data["purchase_price"]) == 35000.0
    assert float(data["sale_price"]) == 60000.0
    assert data["stock"] == 15
    assert data["minimum_stock"] == 3

    # Verify persistence in DB
    db.refresh(product)
    assert product.stock == 15
    assert product.minimum_stock == 3
    assert float(product.sale_price) == 60000.0


def test_06_edit_price_and_stock_simultaneously():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "purchase_price": 40000.0,
        "sale_price": 70000.0,
        "stock": 25,
        "minimum_stock": 8
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert float(data["purchase_price"]) == 40000.0
    assert float(data["sale_price"]) == 70000.0
    assert data["stock"] == 25
    assert data["minimum_stock"] == 8

    # Verify persistence in DB
    db.refresh(product)
    assert float(product.sale_price) == 70000.0
    assert product.stock == 25


def test_07_edit_with_stock_zero_is_valid_and_persisted():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "stock": 0
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["stock"] == 0
    assert float(data["sale_price"]) == 70000.0

    # Verify in DB
    db.refresh(product)
    assert product.stock == 0


def test_08_edit_with_decimal_precision():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    update_payload = {
        "purchase_price": 45000.50,
        "sale_price": 75000.75
    }
    response = client.put(f"/products/{product.id}", json=update_payload)
    assert response.status_code == 200
    data = response.json()
    assert float(data["purchase_price"]) == 45000.50
    assert float(data["sale_price"]) == 75000.75

    # Verify in DB
    db.refresh(product)
    assert float(product.purchase_price) == 45000.50
    assert float(product.sale_price) == 75000.75


def test_09_multi_tenant_isolation_cannot_access_or_edit_other_gym_product():
    global current_test_user
    db = TestingSessionLocal()

    # Product of Gym 1
    prod_gym1 = db.query(Product).filter(Product.gym_id == 1).first()
    assert prod_gym1 is not None

    # Switch to User of Gym 2
    current_test_user = db.query(User).filter(User.id == 2).first()
    assert current_test_user.gym_id == 2

    # Attempt to GET product of Gym 1
    response_get = client.get(f"/products/{prod_gym1.id}")
    assert response_get.status_code == 404

    # Attempt to PUT product of Gym 1
    response_put = client.put(f"/products/{prod_gym1.id}", json={"name": "Hacked Product", "sale_price": 1000.0, "stock": 999})
    assert response_put.status_code == 404

    # Attempt to DELETE product of Gym 1
    response_del = client.delete(f"/products/{prod_gym1.id}")
    assert response_del.status_code == 404

    # Confirm Gym 1 product remains unmodified
    db.refresh(prod_gym1)
    assert prod_gym1.name != "Hacked Product"
    assert float(prod_gym1.sale_price) != 1000.0


def test_10_full_payload_update_preserves_all_fields():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    product = db.query(Product).filter(Product.sku == "NRG-500").first()
    assert product is not None

    # Mimic frontend submit with all fields populated
    full_payload = {
        "category_id": 1,
        "name": "Bebida Energética Ultra",
        "description": "Fórmula mejorada",
        "sku": "NRG-500",
        "purchase_price": 48000.0,
        "sale_price": 80000.0,
        "stock": 50,
        "minimum_stock": 10
    }
    response = client.put(f"/products/{product.id}", json=full_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Bebida Energética Ultra"
    assert data["description"] == "Fórmula mejorada"
    assert float(data["purchase_price"]) == 48000.0
    assert float(data["sale_price"]) == 80000.0
    assert data["stock"] == 50
    assert data["minimum_stock"] == 10
