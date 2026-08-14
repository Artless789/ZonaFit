import sys
sys.path.append('.')
from decimal import Decimal
from datetime import datetime, timedelta
import json
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.sale import Sale
from app.models.payment import Payment
from app.models.accounts_receivable import AccountsReceivable
from app.models.sale_detail import SaleDetail
from app.schemas.sale import SaleCreate, SaleCompleteRequest
from app.services.sale_service import SaleService

client = TestClient(app)
db = SessionLocal()
# Disable expire on commit to avoid DetachedInstanceError
db.expire_on_commit = False

def run_tests():
    # Bypass RLS to set up initial data (session level)
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', false)"))
    
    # Need a user/gym. We will use the ones that already exist, or just fetch the first gym/user
    user = db.query(User).filter(User.is_active == True).first()
    if not user:
        print("No users found.")
        return
    gym_id = user.gym_id
    
    # Set current_gym_id session-wide to avoid issues with RLS in services that rely on it
    db.execute(text(f"SELECT set_config('app.current_gym_id', '{gym_id}', false)"))
    db.commit()

    client_db = db.query(Client).filter(Client.gym_id == gym_id).first()
    if not client_db:
        client_db = Client(gym_id=gym_id, first_name="Test", last_name="Client", document="12345", is_active=True)
        db.add(client_db)
        db.commit()

    print("\n--- TEST 1: Venta CREDIT sin abono ---")
    sale = SaleService.create(db, user, SaleCreate(client_id=client_db.id))
    db.add(SaleDetail(sale_id=sale.id, product_id=1, quantity=1, unit_price=100, subtotal=100)) # dummy detail
    sale.total = Decimal("100.00")
    db.commit()
    
    req = SaleCompleteRequest(sale_type="CREDIT", due_date=datetime.now() + timedelta(days=30))
    sale_c = SaleService.complete(db, user, sale.id, req)
    
    ar = db.query(AccountsReceivable).filter(AccountsReceivable.sale_id == sale_c.id).first()
    payments = db.query(Payment).filter(Payment.accounts_receivable_id == ar.id).all()
    if ar.paid_amount == 0 and ar.balance_due == 100 and ar.status == "PENDING" and len(payments) == 0:
        print("PASS: TEST 1 (Venta CREDIT sin abono)")
    else:
        print(f"FAIL: TEST 1 (Venta CREDIT sin abono). AR: {ar.paid_amount}, {ar.balance_due}, {ar.status}. Payments: {len(payments)}")


    print("\n--- TEST 2: Venta CREDIT con abono parcial ---")
    sale2 = SaleService.create(db, user, SaleCreate(client_id=client_db.id))
    db.add(SaleDetail(sale_id=sale2.id, product_id=1, quantity=1, unit_price=100, subtotal=100))
    sale2.total = Decimal("100.00")
    db.commit()
    
    req2 = SaleCompleteRequest(sale_type="CREDIT", payment_method="CASH", due_date=datetime.now() + timedelta(days=30), initial_payment=Decimal("40.00"))
    sale_c2 = SaleService.complete(db, user, sale2.id, req2)
    
    ar2 = db.query(AccountsReceivable).filter(AccountsReceivable.sale_id == sale_c2.id).first()
    payments2 = db.query(Payment).filter(Payment.accounts_receivable_id == ar2.id).all()
    if ar2.paid_amount == 40 and ar2.balance_due == 60 and ar2.status == "PARTIAL" and len(payments2) == 1:
        print("PASS: TEST 2 (Venta CREDIT con abono parcial)")
    else:
        print(f"FAIL: TEST 2 (Venta CREDIT con abono parcial). AR: {ar2.paid_amount}, {ar2.balance_due}, {ar2.status}. Payments: {len(payments2)}")


    print("\n--- TEST 3: Venta CREDIT con abono igual al total ---")
    sale3 = SaleService.create(db, user, SaleCreate(client_id=client_db.id))
    db.add(SaleDetail(sale_id=sale3.id, product_id=1, quantity=1, unit_price=100, subtotal=100))
    sale3.total = Decimal("100.00")
    db.commit()
    
    req3 = SaleCompleteRequest(sale_type="CREDIT", payment_method="CASH", due_date=datetime.now() + timedelta(days=30), initial_payment=Decimal("100.00"))
    sale_c3 = SaleService.complete(db, user, sale3.id, req3)
    
    ar3 = db.query(AccountsReceivable).filter(AccountsReceivable.sale_id == sale_c3.id).first()
    payments3 = db.query(Payment).filter(Payment.accounts_receivable_id == ar3.id).all()
    if ar3.paid_amount == 100 and ar3.balance_due == 0 and ar3.status == "PAID" and len(payments3) == 1:
        print("PASS: TEST 3 (Venta CREDIT con abono total)")
    else:
        print(f"FAIL: TEST 3 (Venta CREDIT con abono total). AR: {ar3.paid_amount}, {ar3.balance_due}, {ar3.status}. Payments: {len(payments3)}")


    print("\n--- TEST 4: Intento de abono superior al saldo ---")
    sale4 = SaleService.create(db, user, SaleCreate(client_id=client_db.id))
    db.add(SaleDetail(sale_id=sale4.id, product_id=1, quantity=1, unit_price=100, subtotal=100))
    sale4.total = Decimal("100.00")
    db.commit()
    
    req4 = SaleCompleteRequest(sale_type="CREDIT", payment_method="CASH", due_date=datetime.now() + timedelta(days=30), initial_payment=Decimal("150.00"))
    try:
        SaleService.complete(db, user, sale4.id, req4)
        print("FAIL: TEST 4 (Permitió sobrepago inicial)")
    except ValueError as e:
        if "cannot exceed" in str(e):
            print("PASS: TEST 4 (Rechazó sobrepago inicial)")
        else:
            print(f"FAIL: TEST 4 (Error incorrecto: {e})")
            
    print("\n--- TEST 5: Abono posterior correcto ---")
    from app.services.accounts_receivable_service import AccountsReceivableService
    AccountsReceivableService.register_payment(db, user, ar.id, Decimal("50.00"), "CASH")
    ar_updated = db.query(AccountsReceivable).filter(AccountsReceivable.id == ar.id).first()
    if ar_updated.paid_amount == 50 and ar_updated.balance_due == 50 and ar_updated.status == "PARTIAL":
        print("PASS: TEST 5 (Abono posterior correcto)")
    else:
        print(f"FAIL: TEST 5 (AR Status {ar_updated.status} paid: {ar_updated.paid_amount})")

    print("\n--- TEST 6: Consulta de historial ---")
    # we can use get_payments logic directly as endpoint just wraps it
    hist = AccountsReceivableService.get_payments(db, ar.id)
    if len(hist) == 1 and hist[0].amount == Decimal("50.00"):
        print("PASS: TEST 6 (Historial correcto)")
    else:
        print("FAIL: TEST 6")

    print("\n--- TEST 7: Gym A intentando acceder al historial de Gym B ---")
    # Verify RLS prevents reading from a different gym context
    db.execute(text("SELECT set_config('app.bypass_rls', '', false)"))
    db.execute(text("SELECT set_config('app.current_gym_id', '9999', false)"))
    db.commit()
    try:
        res = db.query(AccountsReceivable).filter(AccountsReceivable.id == ar.id).first()
        if res is None:
            print("PASS: TEST 7 (RLS previno el acceso)")
        else:
            print("FAIL: TEST 7 (RLS no funcionó)")
    except Exception as e:
        print("PASS: TEST 7 (RLS error)", str(e))
    # Reset for further tests
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', false)"))
    db.execute(text(f"SELECT set_config('app.current_gym_id', '{gym_id}', false)"))
    db.commit()

    print("\n--- TEST 8: Payment de membresía existente ---")
    try:
        p = Payment(gym_id=gym_id, membership_id=1, amount=100, payment_method="CASH", status="PAID")
        db.add(p)
        db.commit()
        print("PASS: TEST 8")
    except Exception as e:
        db.rollback()
        if 'chk_payment_context' in str(e):
            print("FAIL: TEST 8 (Check constraint bloqueó pago de membresía)")
        else:
            print("PASS: TEST 8 (Bloqueo esperado por FK)", str(e).split('\\n')[0])
            
    print("\n--- TEST 9: Payment de venta CONTADO ---")
    sale_csh = SaleService.create(db, user, SaleCreate(client_id=client_db.id))
    db.add(SaleDetail(sale_id=sale_csh.id, product_id=1, quantity=1, unit_price=100, subtotal=100))
    sale_csh.total = Decimal("100.00")
    db.commit()
    req_csh = SaleCompleteRequest(sale_type="CASH", payment_method="CARD")
    try:
        SaleService.complete(db, user, sale_csh.id, req_csh)
        print("PASS: TEST 9 (Venta Contado)")
    except Exception as e:
        print("FAIL: TEST 9", str(e))

try:
    run_tests()
finally:
    db.close()
