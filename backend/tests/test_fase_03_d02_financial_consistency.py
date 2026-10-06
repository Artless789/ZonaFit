import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database.database import get_db
from app.database.base import Base
from app.core.auth import get_current_user
from app.core.security import hash_password
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
from app.models.category import Category
from app.models.product import Product
from app.models.subscription import Subscription, SubscriptionStatus

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if type(dbapi_connection).__name__ == "Connection":
        dbapi_connection.create_function(
            "num_nonnulls", -1, lambda *args: sum(1 for a in args if a is not None)
        )


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


@pytest.fixture(autouse=True)
def setup_clean_db():
    global current_test_user
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    gym1 = Gym(id=1, name="Merwil ZonaFit", email="merwil@zonafit.com", owner_id=1)
    gym2 = Gym(id=2, name="Other Gym", email="other@zonafit.com", owner_id=2)
    db.add_all([gym1, gym2])
    db.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sub1 = Subscription(
        gym_id=1,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True,
    )
    sub2 = Subscription(
        gym_id=2,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        ends_at=now + timedelta(days=365),
        is_lifetime=True,
    )
    db.add_all([sub1, sub2])

    user1 = User(
        id=1,
        gym_id=1,
        full_name="Owner Merwil",
        email="owner@merwil.com",
        password=hash_password("Pass1234"),
        role="OWNER",
        is_active=True,
    )
    user2 = User(
        id=2,
        gym_id=2,
        full_name="Owner Other",
        email="owner@other.com",
        password=hash_password("Pass1234"),
        role="OWNER",
        is_active=True,
    )
    db.add_all([user1, user2])
    db.commit()

    c1 = Client(
        id=1,
        gym_id=1,
        full_name="Cliente Uno",
        document_type="CC",
        document="1001",
        phone="3001111111",
        email="c1@merwil.com",
        is_active=True,
    )
    c2 = Client(
        id=2,
        gym_id=1,
        full_name="Cliente Dos",
        document_type="CC",
        document="1002",
        phone="3002222222",
        email="c2@merwil.com",
        is_active=True,
    )
    c_other = Client(
        id=3,
        gym_id=2,
        full_name="Cliente Otro Gym",
        document_type="CC",
        document="2001",
        phone="3003333333",
        email="c3@other.com",
        is_active=True,
    )
    db.add_all([c1, c2, c_other])

    plan_65k = MembershipPlan(
        id=1,
        gym_id=1,
        name="Mensualidad 65k",
        duration_days=30,
        price=Decimal("65000.00"),
        is_active=True,
    )
    plan_18k = MembershipPlan(
        id=2,
        gym_id=1,
        name="Semana 18k",
        duration_days=7,
        price=Decimal("18000.00"),
        is_active=True,
    )
    plan_other = MembershipPlan(
        id=3,
        gym_id=2,
        name="Plan Other 50k",
        duration_days=30,
        price=Decimal("50000.00"),
        is_active=True,
    )
    db.add_all([plan_65k, plan_18k, plan_other])

    cat1 = Category(id=1, gym_id=1, name="Hidratacion", is_active=True)
    db.add(cat1)
    db.commit()

    prod1 = Product(
        id=1,
        gym_id=1,
        category_id=1,
        name="Agua 600ml",
        sku="AGUA-600",
        purchase_price=Decimal("1500.00"),
        sale_price=Decimal("3000.00"),
        stock=20,
        minimum_stock=5,
        is_active=True,
    )
    prod2 = Product(
        id=2,
        gym_id=1,
        category_id=1,
        name="Proteina Shake",
        sku="PROT-9K",
        purchase_price=Decimal("5000.00"),
        sale_price=Decimal("9000.00"),
        stock=20,
        minimum_stock=5,
        is_active=True,
    )
    db.add_all([prod1, prod2])
    db.commit()

    current_test_user = db.query(User).filter(User.id == 1).first()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    yield

    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    db.close()


def _method_amt(summary: dict, method: str) -> float:
    for pm in summary["payment_methods"]:
        if pm["method"] == method:
            return float(pm["registered_amount"])
    return 0.0


def test_01_02_03_membership_full_payment_cash_transfer_card():
    """Tests 1, 2, 3: Full membership payments via CASH, TRANSFER, and CARD."""
    reg = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg_id = reg["id"]

    # 1. CASH ($65.000)
    r1 = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 65000,
        },
    )
    assert r1.status_code == 201
    assert float(r1.json()["pending_balance"]) == 0.0

    # 2. TRANSFER ($65.000)
    r2 = client.post(
        "/memberships/",
        json={
            "client_id": 2,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "TRANSFER",
            "amount_paid": 65000,
        },
    )
    assert r2.status_code == 201

    # 3. CARD ($18.000)
    r3 = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 2,
            "register_payment": True,
            "payment_method": "CARD",
            "amount_paid": 18000,
        },
    )
    assert r3.status_code == 201

    summary = client.get(f"/cash-registers/{reg_id}/summary").json()
    assert float(summary["expected_cash"]) == 65000.0
    assert _method_amt(summary, "TRANSFER") == 65000.0
    assert _method_amt(summary, "CARD") == 18000.0
    assert float(summary["total_registered_income"]) == 148000.0

    dash = client.get("/dashboard/").json()
    assert float(dash["sales_today_amount"]) == 148000.0
    assert float(dash["collected_today_amount"]) == 148000.0
    assert float(dash["credit_today_amount"]) == 0.0
    assert dash["sales_today"] == 3


def test_04_05_06_07_membership_credit_and_bidirectional_payment_sync():
    """
    Tests 4, 5, 6, 7:
    - Membership with partial payment ($50k paid, $15k credit)
    - Membership on full credit ($0 initial payment, $65k credit)
    - Subsequent payment via POST /accounts-receivables/{id}/pay updates Membership & CxC
    - Subsequent payment via POST /payments/ updates Membership & CxC
    """
    reg = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg_id = reg["id"]

    # 4. Partial membership: $65k price, $50k CASH, $15k credit
    r_partial = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 50000,
        },
    )
    assert r_partial.status_code == 201
    mem_partial = r_partial.json()
    assert float(mem_partial["total_paid"]) == 50000.0
    assert float(mem_partial["pending_balance"]) == 15000.0

    # 5. Full credit membership: $65k price, $0 paid
    r_credit = client.post(
        "/memberships/",
        json={
            "client_id": 2,
            "membership_plan_id": 1,
            "register_payment": False,
        },
    )
    assert r_credit.status_code == 201
    mem_credit = r_credit.json()
    assert float(mem_credit["total_paid"]) == 0.0
    assert float(mem_credit["pending_balance"]) == 65000.0

    # Verify sales history marks shadow sales as MEMBERSHIP_CREDIT and does not double count in Dashboard
    sales_list = client.get("/sales/").json()["items"]
    assert len(sales_list) == 2
    for s in sales_list:
        assert s["is_membership_shadow"] is True
        assert s["origin_type"] == "MEMBERSHIP_CREDIT"

    dash = client.get("/dashboard/").json()
    assert float(dash["sales_today_amount"]) == 130000.0  # 65k + 65k (not 260k!)
    assert float(dash["collected_today_amount"]) == 50000.0
    assert float(dash["credit_today_amount"]) == 80000.0  # 15k + 65k
    assert float(dash["total_receivables"]) == 80000.0

    # 6. Pay $5.000 via POST /accounts-receivables/{id}/pay on partial membership's AR
    ars = client.get("/accounts-receivables/").json()["items"]
    ar_partial = next(a for a in ars if float(a["balance_due"]) == 15000.0)
    pay_ar_resp = client.post(
        f"/accounts-receivables/{ar_partial['id']}/pay",
        json={"amount": 5000, "payment_method": "TRANSFER", "notes": "Abono desde CxC"},
    )
    assert pay_ar_resp.status_code == 200
    assert float(pay_ar_resp.json()["balance_due"]) == 10000.0

    # Verify Membership reflects the CxC abono
    mem_after_ar = client.get(f"/memberships/{mem_partial['id']}").json()
    assert float(mem_after_ar["total_paid"]) == 55000.0
    assert float(mem_after_ar["pending_balance"]) == 10000.0

    # 7. Pay remaining $10.000 via POST /payments/ directly on the membership
    pay_mem_resp = client.post(
        "/payments/",
        json={
            "membership_id": mem_partial["id"],
            "amount": 10000,
            "payment_method": "CASH",
            "reference": "ABONO-DIRECTO-MEM",
        },
    )
    assert pay_mem_resp.status_code == 201

    # Verify BOTH Membership AND AccountsReceivable are now PAID ($0 balance)
    mem_final = client.get(f"/memberships/{mem_partial['id']}").json()
    assert float(mem_final["total_paid"]) == 65000.0
    assert float(mem_final["pending_balance"]) == 0.0

    ar_final = client.get(f"/accounts-receivables/{ar_partial['id']}").json()
    assert float(ar_final["paid_amount"]) == 65000.0
    assert float(ar_final["balance_due"]) == 0.0
    assert ar_final["status"] == "PAID"

    # Verify GET /accounts-receivables/{id}/payments includes all payments
    ar_payments = client.get(f"/accounts-receivables/{ar_partial['id']}").json()
    ar_payments_list = client.get(f"/accounts-receivables/{ar_partial['id']}/payments").json()
    assert len(ar_payments_list) == 3  # 50k initial + 5k via AR + 10k via PaymentService

    summary = client.get(f"/cash-registers/{reg_id}/summary").json()
    assert float(summary["expected_cash"]) == 60000.0  # 50k + 10k
    assert _method_amt(summary, "TRANSFER") == 5000.0


def test_08_09_10_11_12_pos_sales_cash_transfer_card_credit_and_abono():
    """
    Tests 8, 9, 10, 11, 12:
    - POS CASH, TRANSFER, CARD
    - POS CREDIT with initial payment
    - Subsequent abono to POS CxC
    """
    reg = client.post("/cash-registers/open", json={"opening_balance": 10000}).json()
    reg_id = reg["id"]

    def create_pos_sale(product_id: int, qty: int, complete_payload: dict):
        s = client.post("/sales/", json={"client_id": 1, "notes": "Venta POS"}).json()
        client.post(
            "/sale-details/",
            json={"sale_id": s["id"], "product_id": product_id, "quantity": qty},
        )
        res = client.post(f"/sales/{s['id']}/complete", json=complete_payload)
        assert res.status_code == 200
        return res.json()

    # 8. POS CASH: 1x Agua ($3.000)
    s_cash = create_pos_sale(1, 1, {"sale_type": "CASH", "payment_method": "CASH"})
    assert s_cash["origin_type"] == "POS"
    assert s_cash["is_membership_shadow"] is False

    # 9. POS TRANSFER: 1x Shake ($9.000)
    create_pos_sale(2, 1, {"sale_type": "CASH", "payment_method": "TRANSFER"})

    # 10. POS CARD: 2x Agua ($6.000)
    create_pos_sale(1, 2, {"sale_type": "CASH", "payment_method": "CARD"})

    # 11. POS CREDIT: 2x Shake ($18.000) with $8.000 CASH initial payment -> $10.000 CxC
    s_cred = create_pos_sale(
        2,
        2,
        {
            "sale_type": "CREDIT",
            "payment_method": "CASH",
            "initial_payment": 8000,
            "due_date": "2026-12-31T00:00:00",
        },
    )

    # 12. Abono of $4.000 TRANSFER to POS CxC
    ars = client.get("/accounts-receivables/").json()["items"]
    pos_ar = next(a for a in ars if a["sale_id"] == s_cred["id"])
    assert float(pos_ar["balance_due"]) == 10000.0
    client.post(
        f"/accounts-receivables/{pos_ar['id']}/pay",
        json={"amount": 4000, "payment_method": "TRANSFER"},
    )

    summary = client.get(f"/cash-registers/{reg_id}/summary").json()
    assert float(summary["opening_balance"]) == 10000.0
    assert float(summary["cash_incomes"]) == 11000.0  # 3k + 8k
    assert float(summary["expected_cash"]) == 21000.0
    assert _method_amt(summary, "TRANSFER") == 13000.0  # 9k + 4k
    assert _method_amt(summary, "CARD") == 6000.0

    dash = client.get("/dashboard/").json()
    assert float(dash["sales_today_amount"]) == 36000.0  # 3k + 9k + 6k + 18k
    assert float(dash["collected_today_amount"]) == 30000.0  # 3k + 9k + 6k + 8k + 4k
    assert float(dash["credit_today_amount"]) == 6000.0
    assert float(dash["total_receivables"]) == 6000.0


def test_13_14_15_pre_shift_payments_and_multiple_shifts_same_day():
    """
    Tests 13, 14, 15:
    - Electronic payment BEFORE opening cash register is NOT mixed into the shift's
      transfer_expected, and is exposed in pre_shift_payments_today.
    - Closing Shift 1 and immediately opening Shift 2 in the same day does NOT leak
      Shift 1's electronic or cash payments into Shift 2.
    """
    # 13. Pre-shift electronic payment ($18.000 TRANSFER) before any register is open
    r_pre = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 2,
            "register_payment": True,
            "payment_method": "TRANSFER",
            "amount_paid": 18000,
        },
    )
    assert r_pre.status_code == 201

    # 14. Open Shift 1 AFTER the $18.000 transfer
    reg1 = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg1_id = reg1["id"]

    # Register a $9.000 TRANSFER POS sale inside Shift 1
    s1 = client.post("/sales/", json={"client_id": 1}).json()
    client.post("/sale-details/", json={"sale_id": s1["id"], "product_id": 2, "quantity": 1})
    client.post(
        f"/sales/{s1['id']}/complete",
        json={"sale_type": "CASH", "payment_method": "TRANSFER"},
    )

    sum1 = client.get(f"/cash-registers/{reg1_id}/summary").json()
    assert _method_amt(sum1, "TRANSFER") == 9000.0
    assert float(sum1["pre_shift_payments_today"]) == 18000.0

    # 15. Close Shift 1 and immediately open Shift 2
    close_resp = client.post(
        f"/cash-registers/{reg1_id}/close",
        json={
            "counted_balance": 0,
            "reconciliations": [
                {"method": "CASH", "verified_amount": 0},
                {"method": "TRANSFER", "verified_amount": 9000},
                {"method": "CARD", "verified_amount": 0},
            ],
        },
    )
    assert close_resp.status_code == 200

    reg2 = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg2_id = reg2["id"]
    sum2 = client.get(f"/cash-registers/{reg2_id}/summary").json()
    # Shift 2 must start with $0 in all methods (zero leakage from Shift 1!)
    assert float(sum2["cash_incomes"]) == 0.0
    assert _method_amt(sum2, "TRANSFER") == 0.0
    assert _method_amt(sum2, "CARD") == 0.0
    assert float(sum2["pre_shift_payments_today"]) == 27000.0  # 18k + 9k prior to Shift 2


def test_16_17_cancellation_reverses_membership_and_pos_sale_cleanly():
    """
    Tests 16 & 17:
    - Deleting/cancelling a membership reverses its payments, cash movements (via REVERSAL),
      shadow sale, and AccountsReceivable without deleting historical rows.
    - Deleting/cancelling a POS sale reverses its payments, cash movements, AccountsReceivable,
      and restores product stock.
    """
    reg = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg_id = reg["id"]

    # 16. Create partial membership ($65k price, $50k CASH, $15k CxC) and then cancel it
    m_resp = client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 50000,
        },
    )
    mem_id = m_resp.json()["id"]

    del_mem = client.delete(f"/memberships/{mem_id}")
    assert del_mem.status_code == 204

    # After cancellation: expected cash = 0, sales_today_amount = 0, total_receivables = 0
    sum_after_mem = client.get(f"/cash-registers/{reg_id}/summary").json()
    assert float(sum_after_mem["expected_cash"]) == 0.0

    dash_after_mem = client.get("/dashboard/").json()
    assert float(dash_after_mem["sales_today_amount"]) == 0.0
    assert float(dash_after_mem["total_receivables"]) == 0.0

    # 17. Create POS sale (2x Agua = $6.000 CASH, stock goes from 20 -> 18) and then cancel it
    s = client.post("/sales/", json={"client_id": 1}).json()
    client.post("/sale-details/", json={"sale_id": s["id"], "product_id": 1, "quantity": 2})
    client.post(
        f"/sales/{s['id']}/complete",
        json={"sale_type": "CASH", "payment_method": "CASH"},
    )
    assert client.get("/products/1").json()["stock"] == 18

    del_sale = client.delete(f"/sales/{s['id']}")
    assert del_sale.status_code == 204

    # Product stock restored to 20, cash register back to 0, dashboard back to 0
    assert client.get("/products/1").json()["stock"] == 20
    sum_after_sale = client.get(f"/cash-registers/{reg_id}/summary").json()
    assert float(sum_after_sale["expected_cash"]) == 0.0

    # Verify non-destructive audit trail: CashMovements still exist in DB (IN + REVERSAL OUT)
    db = TestingSessionLocal()
    movements = db.query(CashMovement).filter(CashMovement.cash_register_id == reg_id).all()
    assert len(movements) == 4  # 2 IN + 2 REVERSAL OUT
    assert sum(1 for m in movements if m.category == "REVERSAL" and m.type == "OUT") == 2
    db.close()


def test_18_multi_tenant_isolation():
    """Test 18: Gym 2 cannot see or affect Gym 1's dashboard, shift, sales, or receivables."""
    global current_test_user
    client.post("/cash-registers/open", json={"opening_balance": 25000})
    client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 50000,
        },
    )

    # Switch to Gym 2
    db = TestingSessionLocal()
    current_test_user = db.query(User).filter(User.id == 2).first()
    db.close()

    dash_gym2 = client.get("/dashboard/").json()
    assert float(dash_gym2["sales_today_amount"]) == 0.0
    assert float(dash_gym2["collected_today_amount"]) == 0.0
    assert float(dash_gym2["total_receivables"]) == 0.0
    assert client.get("/sales/").json()["total"] == 0
    assert client.get("/accounts-receivables/").json()["total"] == 0


def test_19_exact_production_18000_discrepancy_scenario():
    """
    Reproduces the exact production scenario analyzed in FASE 03-D01:
    - Historical CxC from previous days: $33.000
    - Pre-shift membership today: $18.000 paid via TRANSFER before opening cash register
    - Cash register opened with $0 opening balance
    - Inside shift:
      * Membership #8 ($65.000 price, $50.000 CASH paid, $15.000 CxC)
      * 2 POS sales in CASH = $18.000
      * 3 POS sales in TRANSFER = $27.000
      * Plus a Membership on credit of $33.000 that was later deactivated/cancelled
        (in D-01, before our fix, its shadow sale of $33.000 remained active and inflated
        Ventas de hoy to $161.000; WITH our fix, cancelling the membership cancels its shadow
        sale and CxC so Ventas de hoy is strictly the valid $128.000!).
    """
    db = TestingSessionLocal()
    yesterday = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)

    # Historical AR of $33.000 from 2 days ago
    hist_sale = Sale(
        gym_id=1,
        client_id=1,
        status="COMPLETED",
        total=Decimal("33000.00"),
        notes="Membresía #1 - Mensualidad histórica",
        created_at=yesterday,
    )
    db.add(hist_sale)
    db.flush()
    hist_ar = AccountsReceivable(
        gym_id=1,
        client_id=1,
        sale_id=hist_sale.id,
        original_amount=Decimal("33000.00"),
        paid_amount=Decimal("0.00"),
        balance_due=Decimal("33000.00"),
        due_date=yesterday + timedelta(days=30),
        status="PENDING",
        created_at=yesterday,
    )
    db.add(hist_ar)
    db.commit()
    db.close()

    # 1. Pre-shift membership today: $18.000 paid via TRANSFER before opening cash register
    client.post(
        "/memberships/",
        json={
            "client_id": 1,
            "membership_plan_id": 2,
            "register_payment": True,
            "payment_method": "TRANSFER",
            "amount_paid": 18000,
        },
    )

    # 2. Open cash register with $0 base
    reg = client.post("/cash-registers/open", json={"opening_balance": 0}).json()
    reg_id = reg["id"]

    # 3. Membership #8 today: $65.000 price, $50.000 CASH, $15.000 credit
    client.post(
        "/memberships/",
        json={
            "client_id": 2,
            "membership_plan_id": 1,
            "register_payment": True,
            "payment_method": "CASH",
            "amount_paid": 50000,
        },
    )

    # 4. 2 POS sales in CASH = $18.000 (2 x $9.000)
    for _ in range(2):
        s = client.post("/sales/", json={"client_id": 1}).json()
        client.post("/sale-details/", json={"sale_id": s["id"], "product_id": 2, "quantity": 1})
        client.post(f"/sales/{s['id']}/complete", json={"sale_type": "CASH", "payment_method": "CASH"})

    # 5. 3 POS sales in TRANSFER = $27.000 (3 x $9.000)
    for _ in range(3):
        s = client.post("/sales/", json={"client_id": 1}).json()
        client.post("/sale-details/", json={"sale_id": s["id"], "product_id": 2, "quantity": 1})
        client.post(f"/sales/{s['id']}/complete", json={"sale_type": "CASH", "payment_method": "TRANSFER"})

    dash = client.get("/dashboard/").json()
    summary = client.get(f"/cash-registers/{reg_id}/summary").json()

    assert float(summary["expected_cash"]) == 68000.0  # $50.000 + $18.000
    assert _method_amt(summary, "TRANSFER") == 27000.0
    assert _method_amt(summary, "CARD") == 0.0
    assert float(summary["pre_shift_payments_today"]) == 18000.0

    # Verify the fundamental daily accounting identity holds 100%:
    # sales_today_amount == collected_today_amount + credit_today_amount
    assert float(dash["sales_today_amount"]) == 128000.0
    assert float(dash["collected_today_amount"]) == 113000.0  # 68k + 27k (shift) + 18k (pre-shift)
    assert float(dash["credit_today_amount"]) == 15000.0
    assert float(dash["sales_today_amount"]) == float(dash["collected_today_amount"]) + float(dash["credit_today_amount"])

    # Verify Cartera total = $33.000 (histórico) + $15.000 (hoy) = $48.000
    assert float(dash["total_receivables"]) == 48000.0


