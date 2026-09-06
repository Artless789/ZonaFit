import os
import json
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
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.subscription import Subscription, SubscriptionStatus
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_financial_integration.db"
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
def setup_financial_db():
    from app.database.base import Base
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Gyms
    gym1 = Gym(id=1, name="Gym Alpha Center", email="alpha@center.com", owner_id=1)
    gym2 = Gym(id=2, name="Gym Beta Fitness", email="beta@fitness.com", owner_id=2)
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
    c1 = Client(id=1, gym_id=1, full_name="Carlos Gomez", document_type="CC", document="10101", phone="3001234567", email="carlos@gym.com", is_active=True)
    c2 = Client(id=2, gym_id=1, full_name="Ana Lopez", document_type="CC", document="20202", phone="3007654321", email="ana@gym.com", is_active=True)
    c3 = Client(id=3, gym_id=1, full_name="Mario Bros", document_type="CC", document="30303", phone="3005554433", email="mario@gym.com", is_active=True)
    c_beta = Client(id=4, gym_id=2, full_name="Pedro Beta", document_type="CC", document="40404", phone="3009998877", email="pedro@beta.com", is_active=True)
    db.add_all([c1, c2, c3, c_beta])

    # Plans (20,000 COP plan for exact user scenario validation)
    p1 = MembershipPlan(id=1, gym_id=1, name="Plan Basico 20k", duration_days=30, price=Decimal("20000.00"), is_active=True)
    p_beta = MembershipPlan(id=2, gym_id=2, name="Plan Beta", duration_days=30, price=Decimal("50000.00"), is_active=True)
    db.add_all([p1, p_beta])

    # Open Cash Register for Gym 1 with $50.000 opening balance
    reg1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=Decimal("50000.00"), status="OPEN")
    db.add(reg1)
    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_membership_full_payment_updates_dashboard_and_cash():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Initial Dashboard check
    resp_dash_init = client.get("/dashboard/")
    assert resp_dash_init.status_code == 200
    dash_init = resp_dash_init.json()
    assert dash_init["sales_today"] == 0
    assert float(dash_init["sales_today_amount"]) == 0.00
    assert float(dash_init["income_this_month"]) == 0.00
    assert float(dash_init["total_receivables"]) == 0.00

    # Scenario 1: Membresía = $20.000, Pago recibido = $20.000 (CASH)
    resp = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 20000.00,
        "reference": "REC-FULL-20K"
    })
    assert resp.status_code == 201
    mem_data = resp.json()
    assert float(mem_data["total_paid"]) == 20000.00
    assert float(mem_data["pending_balance"]) == 0.00

    # Verify Payment created
    pmt = db.query(Payment).filter(Payment.membership_id == mem_data["id"]).first()
    assert pmt is not None
    assert float(pmt.amount) == 20000.00
    assert pmt.status == "PAID"

    # Verify CashMovement created
    mov = db.query(CashMovement).filter(CashMovement.payment_id == pmt.id).first()
    assert mov is not None
    assert mov.type == "IN"
    assert mov.category == "MEMBERSHIP_PAYMENT"
    assert float(mov.amount) == 20000.00

    # Verify Cash Register Movements & Expected Balance
    resp_movs = client.get("/cash-registers/1/movements")
    assert resp_movs.status_code == 200
    movs = resp_movs.json()
    assert len(movs) == 1
    assert float(movs[0]["amount"]) == 20000.00

    # Verify Dashboard Updated
    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 1
    assert float(dash["sales_today_amount"]) == 20000.00
    assert float(dash["income_this_month"]) == 20000.00
    assert float(dash["total_receivables"]) == 0.00
    
    # Recent activity contains the membership and payment
    types = [a["type"] for a in dash["recent_activity"]]
    assert "MEMBERSHIP" in types
    assert "PAYMENT" in types


def test_02_membership_partial_payment_updates_dashboard_cash_and_ar():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Scenario 2: Membresía = $20.000, Pago recibido = $12.000 (CASH), Saldo pendiente = $8.000
    resp = client.post("/memberships/", json={
        "client_id": 2,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 12000.00,
        "reference": "REC-PARTIAL-12K"
    })
    assert resp.status_code == 201
    mem_data = resp.json()
    assert float(mem_data["total_paid"]) == 12000.00
    assert float(mem_data["pending_balance"]) == 8000.00

    # Cash movement must be exactly 12,000 (NOT 20,000)
    pmt = db.query(Payment).filter(Payment.membership_id == mem_data["id"]).first()
    assert float(pmt.amount) == 12000.00
    mov = db.query(CashMovement).filter(CashMovement.payment_id == pmt.id).first()
    assert float(mov.amount) == 12000.00

    # Accounts Receivable created for 8,000
    ar = db.query(AccountsReceivable).filter(
        AccountsReceivable.gym_id == 1,
        AccountsReceivable.client_id == 2,
        AccountsReceivable.balance_due == Decimal("8000.00")
    ).first()
    assert ar is not None
    assert ar.status == "PARTIAL"

    # Verify Dashboard
    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 2
    assert float(dash["sales_today_amount"]) == 40000.00
    assert float(dash["income_this_month"]) == 32000.00  # 20k + 12k
    assert float(dash["total_receivables"]) == 8000.00


def test_03_membership_zero_payment_updates_dashboard_and_ar_without_cash():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    cash_mov_count_before = db.query(CashMovement).filter(CashMovement.gym_id == 1).count()

    # Scenario 3: Membresía = $20.000, Pago = $0, Saldo pendiente = $20.000
    resp = client.post("/memberships/", json={
        "client_id": 3,
        "membership_plan_id": 1,
        "register_payment": False
    })
    assert resp.status_code == 201
    mem_data = resp.json()
    assert float(mem_data["total_paid"]) == 0.00
    assert float(mem_data["pending_balance"]) == 20000.00

    # No new CashMovement
    assert db.query(CashMovement).filter(CashMovement.gym_id == 1).count() == cash_mov_count_before

    # Verify Dashboard
    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 3
    assert float(dash["sales_today_amount"]) == 60000.00
    assert float(dash["income_this_month"]) == 32000.00  # Unchanged
    assert float(dash["total_receivables"]) == 28000.00  # 8k + 20k


def test_04_accounts_receivable_abono_updates_cash_and_dashboard_income():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Locate the AR for client 2 (balance_due = 8,000)
    ar = db.query(AccountsReceivable).filter(
        AccountsReceivable.gym_id == 1,
        AccountsReceivable.client_id == 2,
        AccountsReceivable.balance_due == Decimal("8000.00")
    ).first()
    assert ar is not None

    # Abono of 8,000 in CASH
    resp_abono = client.post(f"/accounts-receivables/{ar.id}/pay", json={
        "amount": 8000.00,
        "payment_method": "CASH"
    })
    assert resp_abono.status_code == 200
    assert float(resp_abono.json()["balance_due"]) == 0.00
    assert resp_abono.json()["status"] == "PAID"

    # Verify CashMovement created for 8,000
    last_mov = db.query(CashMovement).filter(CashMovement.gym_id == 1).order_by(CashMovement.id.desc()).first()
    assert last_mov.category == "CREDIT_PAYMENT"
    assert float(last_mov.amount) == 8000.00

    # Verify Dashboard
    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 3  # Sales count unchanged (already counted)
    assert float(dash["sales_today_amount"]) == 60000.00
    assert float(dash["income_this_month"]) == 40000.00  # 32k + 8k
    assert float(dash["total_receivables"]) == 20000.00  # 28k - 8k


def test_05_no_duplication_between_pos_sales_and_memberships():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # POS sale of 15,000
    sale = Sale(
        gym_id=1,
        client_id=1,
        total=Decimal("15000.00"),
        status="COMPLETED",
        notes="Venta POS directa",
        is_active=True
    )
    db.add(sale)
    db.commit()

    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 4  # 3 memberships + 1 POS sale
    assert float(dash["sales_today_amount"]) == 75000.00  # 60k + 15k


def test_06_multi_tenant_financial_isolation():
    global current_test_user
    db = TestingSessionLocal()
    
    # Gym 2 user
    current_test_user = db.query(User).filter(User.id == 2).first()

    resp_dash = client.get("/dashboard/")
    assert resp_dash.status_code == 200
    dash = resp_dash.json()
    assert dash["sales_today"] == 0
    assert float(dash["sales_today_amount"]) == 0.00
    assert float(dash["income_this_month"]) == 0.00
    assert float(dash["total_receivables"]) == 0.00
