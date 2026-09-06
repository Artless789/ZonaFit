import os
import json
import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock
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
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.models.subscription import Subscription, SubscriptionStatus
from app.services.notification_service import NotificationService
from app.constants.notification_statuses import NotificationStatus
from app.constants.notification_channels import NotificationChannel
from app.constants.notification_event_types import NotificationEventType
from app.core.security import hash_password
from sqlalchemy import event
from sqlalchemy.engine import Engine

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_membership_complete_flow.db"
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
def setup_complete_flow_db():
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
    c_beta = Client(id=3, gym_id=2, full_name="Pedro Beta", document_type="CC", document="30303", phone="3009998877", email="pedro@beta.com", is_active=True)
    db.add_all([c1, c2, c_beta])

    # Plans
    p1 = MembershipPlan(id=1, gym_id=1, name="Plan Mensual", duration_days=30, price=Decimal("120000.00"), is_active=True)
    p2 = MembershipPlan(id=2, gym_id=1, name="Plan Trimestral", duration_days=90, price=Decimal("300000.00"), is_active=True)
    p_beta = MembershipPlan(id=3, gym_id=2, name="Plan Beta", duration_days=30, price=Decimal("150000.00"), is_active=True)
    db.add_all([p1, p2, p_beta])

    # Open Cash Register for Gym 1
    reg1 = CashRegister(id=1, gym_id=1, opened_by=1, opening_balance=Decimal("50000.00"), status="OPEN")
    db.add(reg1)

    # Notification Template for Gym 1
    tmpl = NotificationTemplate(
        id=1,
        gym_id=1,
        event_type=NotificationEventType.PAYMENT_RECEIVED,
        channel=NotificationChannel.WHATSAPP,
        template_body="Hola {client_name}, recibimos tu pago de {amount} para tu {membership_name} en {gym_name}.",
        is_active=True
    )
    db.add(tmpl)

    db.commit()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)


def test_01_membership_custom_start_date_and_end_date_calculation():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Create membership starting 5 days in the future (e.g. 2026-08-25)
    future_start = (datetime.now(timezone.utc) + timedelta(days=5)).replace(microsecond=0)
    
    payload = {
        "client_id": 1,
        "membership_plan_id": 1,
        "start_date": future_start.isoformat(),
        "trainer_name": "Coach Alexander"
    }

    resp = client.post("/memberships/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["client_id"] == 1
    assert data["membership_plan_id"] == 1
    assert data["trainer_name"] == "Coach Alexander"
    assert float(data["price"]) == 120000.00
    
    start_dt = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
    
    assert (end_dt - start_dt).days == 30
    assert float(data["total_paid"]) == 0.00
    assert float(data["pending_balance"]) == 120000.00


def test_02_membership_full_payment_cash_creates_cash_movement_and_no_ar():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    initial_cash_mov_count = db.query(CashMovement).filter(CashMovement.gym_id == 1).count()
    initial_ar_count = db.query(AccountsReceivable).filter(AccountsReceivable.gym_id == 1).count()

    payload = {
        "client_id": 2,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 120000.00,
        "reference": "REC-CASH-FULL"
    }

    resp = client.post("/memberships/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    
    assert float(data["total_paid"]) == 120000.00
    assert float(data["pending_balance"]) == 0.00
    assert len(data["payments"]) == 1
    assert float(data["payments"][0]["amount"]) == 120000.00
    assert data["payments"][0]["payment_method"] == "CASH"

    # Verify CashMovement created
    new_cash_movs = db.query(CashMovement).filter(CashMovement.gym_id == 1).all()
    assert len(new_cash_movs) == initial_cash_mov_count + 1
    last_mov = new_cash_movs[-1]
    assert last_mov.type == "IN"
    assert last_mov.category == "MEMBERSHIP_PAYMENT"
    assert float(last_mov.amount) == 120000.00

    # Verify NO AccountsReceivable created since balance is 0
    new_ar_count = db.query(AccountsReceivable).filter(AccountsReceivable.gym_id == 1).count()
    assert new_ar_count == initial_ar_count


def test_03_membership_zero_payment_creates_ar_and_no_cash_movement():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    initial_cash_mov_count = db.query(CashMovement).filter(CashMovement.gym_id == 1).count()
    initial_payments_count = db.query(Payment).filter(Payment.gym_id == 1).count()

    payload = {
        "client_id": 1,
        "membership_plan_id": 2, # Plan Trimestral 300,000 COP
        "register_payment": False
    }

    resp = client.post("/memberships/", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert float(data["total_paid"]) == 0.00
    assert float(data["pending_balance"]) == 300000.00
    assert len(data["payments"]) == 0

    # Verify NO Payment or CashMovement
    assert db.query(CashMovement).filter(CashMovement.gym_id == 1).count() == initial_cash_mov_count
    assert db.query(Payment).filter(Payment.gym_id == 1).count() == initial_payments_count

    # Verify AccountsReceivable created for $300,000
    ar = db.query(AccountsReceivable).filter(
        AccountsReceivable.gym_id == 1,
        AccountsReceivable.client_id == 1,
        AccountsReceivable.balance_due == Decimal("300000.00")
    ).first()
    assert ar is not None
    assert ar.status == "PENDING"
    assert float(ar.paid_amount) == 0.00


def test_04_membership_partial_payment_creates_cash_and_ar_balance():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    initial_cash_mov_count = db.query(CashMovement).filter(CashMovement.gym_id == 1).count()

    # Total 120,000, initial payment 70,000 in CASH -> Balance 50,000
    payload = {
        "client_id": 1,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 70000.00,
        "reference": "REC-PARTIAL-1"
    }

    resp = client.post("/memberships/", json=payload)
    assert resp.status_code == 201
    data = resp.json()

    assert float(data["total_paid"]) == 70000.00
    assert float(data["pending_balance"]) == 50000.00

    # Verify CashMovement for 70,000
    assert db.query(CashMovement).filter(CashMovement.gym_id == 1).count() == initial_cash_mov_count + 1
    last_mov = db.query(CashMovement).filter(CashMovement.gym_id == 1).order_by(CashMovement.id.desc()).first()
    assert float(last_mov.amount) == 70000.00

    # Verify AccountsReceivable for remaining 50,000
    ar = db.query(AccountsReceivable).filter(
        AccountsReceivable.gym_id == 1,
        AccountsReceivable.client_id == 1,
        AccountsReceivable.balance_due == Decimal("50000.00")
    ).first()
    assert ar is not None
    assert ar.status == "PARTIAL"
    assert float(ar.paid_amount) == 70000.00
    assert float(ar.original_amount) == 120000.00


def test_05_accounts_receivable_abonos_reduce_balance_and_sync_membership():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Locate the AR from test_04 (balance_due = 50,000)
    ar = db.query(AccountsReceivable).filter(
        AccountsReceivable.gym_id == 1,
        AccountsReceivable.client_id == 1,
        AccountsReceivable.balance_due == Decimal("50000.00")
    ).first()
    assert ar is not None
    ar_id = ar.id

    # 1. Abono of 30,000 in CASH
    abono1_resp = client.post(f"/accounts-receivables/{ar_id}/pay", json={
        "amount": 30000.00,
        "payment_method": "CASH"
    })
    assert abono1_resp.status_code == 200
    ar_data = abono1_resp.json()
    assert float(ar_data["balance_due"]) == 20000.00
    assert float(ar_data["paid_amount"]) == 100000.00
    assert ar_data["status"] == "PARTIAL"

    # 2. Final Abono of 20,000 in TRANSFER
    abono2_resp = client.post(f"/accounts-receivables/{ar_id}/pay", json={
        "amount": 20000.00,
        "payment_method": "TRANSFER"
    })
    assert abono2_resp.status_code == 200
    ar_data_final = abono2_resp.json()
    assert float(ar_data_final["balance_due"]) == 0.00
    assert float(ar_data_final["paid_amount"]) == 120000.00
    assert ar_data_final["status"] == "PAID"


def test_06_cash_payment_without_active_cash_register_fails():
    global current_test_user
    db = TestingSessionLocal()
    
    # Gym 2 has NO active cash register
    current_test_user = db.query(User).filter(User.id == 2).first()

    payload = {
        "client_id": 3,
        "membership_plan_id": 3,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 150000.00
    }

    resp = client.post("/memberships/", json=payload)
    assert resp.status_code == 400
    assert "sin una caja abierta" in resp.json()["detail"]


def test_07_cannot_pay_negative_or_exceeding_amounts():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    # Negative amount
    resp1 = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": -5000.00
    })
    assert resp1.status_code == 400

    # Exceeding amount (150k on 120k plan)
    resp2 = client.post("/memberships/", json={
        "client_id": 1,
        "membership_plan_id": 1,
        "register_payment": True,
        "payment_method": "CASH",
        "amount_paid": 150000.00
    })
    assert resp2.status_code == 400
    assert "no puede superar el total" in resp2.json()["detail"]


def test_08_whatsapp_notification_dispatch_mocked():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    mock_response = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "573001234567", "wa_id": "573001234567"}],
        "messages": [{"id": "wamid.MEMBERSHIP_PAY"}]
    }

    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "100200300", "WHATSAPP_ACCESS_TOKEN": "valid_token"}):
        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_cm = MagicMock()
            mock_cm.read.return_value = json.dumps(mock_response).encode("utf-8")
            mock_urlopen.return_value.__enter__.return_value = mock_cm

            payload = {
                "client_id": 1,
                "membership_plan_id": 1,
                "register_payment": True,
                "payment_method": "CASH",
                "amount_paid": 120000.00
            }

            resp = client.post("/memberships/", json=payload)
            assert resp.status_code == 201

            # Check dispatched notification
            notif = db.query(Notification).filter(
                Notification.gym_id == 1,
                Notification.client_id == 1,
                Notification.event_type == NotificationEventType.PAYMENT_RECEIVED
            ).order_by(Notification.id.desc()).first()

            assert notif is not None
            assert notif.status == NotificationStatus.PENDING
            assert notif.recipient == "573001234567"

            # Execute background task
            NotificationService.send_and_update(notif.id, db=db)
            db.expire_all()
            updated_notif = db.query(Notification).filter(Notification.id == notif.id).first()
            assert updated_notif.status == NotificationStatus.SENT


def test_09_whatsapp_unconfigured_does_not_break_financial_flow():
    global current_test_user
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 1).first()

    with patch.dict(os.environ, {"WHATSAPP_PHONE_NUMBER_ID": "", "WHATSAPP_ACCESS_TOKEN": ""}):
        payload = {
            "client_id": 2,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 120000.00
        }

        resp = client.post("/memberships/", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert float(data["total_paid"]) == 120000.00
        assert float(data["pending_balance"]) == 0.00

        # Execute background task without credentials
        notif = db.query(Notification).filter(
            Notification.gym_id == 1,
            Notification.client_id == 2,
            Notification.event_type == NotificationEventType.PAYMENT_RECEIVED
        ).order_by(Notification.id.desc()).first()

        if notif:
            NotificationService.send_and_update(notif.id, db=db)
            db.expire_all()
            failed_notif = db.query(Notification).filter(Notification.id == notif.id).first()
            assert failed_notif.status == NotificationStatus.FAILED
            assert "not configured" in failed_notif.error_detail


def test_10_multi_tenant_isolation_membership_payments_ar():
    global current_test_user
    db = TestingSessionLocal()

    # User 2 (Beta) cannot see Gym 1's memberships or accounts receivable
    current_test_user = db.query(User).filter(User.id == 2).first()

    resp_mem = client.get("/memberships/1")
    assert resp_mem.status_code == 404

    resp_ar = client.get("/accounts-receivables/1")
    assert resp_ar.status_code == 404
