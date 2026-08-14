import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import uuid
import hashlib
import threading
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.subscription_payment import SubscriptionPayment
from app.models.subscription import Subscription
from app.models.plan import Plan
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.config import settings
import concurrent.futures

client = TestClient(app)

def create_mock_webhook_payload(reference, amount, currency, status, provider_id, override_checksum=None):
    timestamp = "1234567890"
    if override_checksum:
        checksum = override_checksum
    else:
        concatenated = f"{reference}{amount}{currency}{status}{timestamp}{settings.WOMPI_EVENTS_SECRET}"
        checksum = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
    
    return {
        "event": "transaction.updated",
        "data": {
            "transaction": {
                "id": provider_id,
                "reference": reference,
                "amount_in_cents": amount,
                "currency": currency,
                "status": status
            }
        },
        "signature": {
            "properties": ["transaction.reference", "transaction.amount_in_cents", "transaction.currency", "transaction.status"],
            "checksum": checksum
        },
        "timestamp": timestamp
    }

def setup_test_data():
    run_id = uuid.uuid4().hex[:6]
    email = f"test_{run_id}@wompi.com"
    client.post("/auth/register", json={
        "owner_name": "Test Wompi",
        "owner_email": email,
        "owner_password": "Password123!",
        "gym_name": "Gym Wompi",
        "gym_phone": "123",
        "gym_address": "Addr W",
        "gym_city": "City W"
    })
    
    res = client.post("/auth/login", data={"username": email, "password": "Password123!"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get gym_id
    me = client.get("/auth/me", headers=headers).json()
    gym_id = me["gym_id"]
    
    # Manually create subscription for testing
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        plan = db.query(Plan).first()
        if not plan:
            plan = Plan(name="Test Plan", price=100.0, currency="COP", features={}, is_active=True, billing_interval="MONTHLY")
            db.add(plan)
            db.commit()
            db.refresh(plan)
        from datetime import datetime, timedelta
        sub = db.query(Subscription).filter(Subscription.gym_id == gym_id).first()
        if not sub:
            sub = Subscription(
                gym_id=gym_id, plan_id=plan.id, status="TRIAL",
                starts_at=datetime.utcnow(),
                ends_at=datetime.utcnow() + timedelta(days=30)
            )
            db.add(sub)
            db.commit()
    finally:
        db.close()
    
    # Get plan and sub details to init payment
    res_sub = client.get("/subscription/me", headers=headers)
    if res_sub.status_code != 200:
        raise Exception(f"Failed to get subscription: {res_sub.text}")
    sub_data = res_sub.json()
    sub_id = sub_data["id"]
    
    res = client.post(f"/subscription/{sub_id}/payment", headers=headers)
    payment_init = res.json()
    
    return sub_id, payment_init

def get_ends_at(sub_id):
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
        return sub.ends_at
    finally:
        db.close()

def run_tests():
    print("Setting up test data...")
    sub_id, payment_init = setup_test_data()
    reference = payment_init["reference"]
    amount = payment_init["amount_in_cents"]
    currency = payment_init["currency"]
    
    print(f"Test payment generated: {reference}")
    
    ends_at_before = get_ends_at(sub_id)
    print(f"ends_at before: {ends_at_before}")
    
    # --- PRUEBA 4: Firma inválida ---
    print("\n--- PRUEBA 4: Firma inválida ---")
    payload = create_mock_webhook_payload(reference, amount, currency, "APPROVED", "w-1", override_checksum="invalid_checksum")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert res.status_code == 200 # webhook always returns 200 to wompi
    assert "Invalid signature" in res.text
    
    # --- PRUEBA 5: Amount manipulado ---
    print("\n--- PRUEBA 5: Amount manipulado ---")
    payload = create_mock_webhook_payload(reference, amount + 100, currency, "APPROVED", "w-1")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert "Data mismatch" in res.text
    
    # --- PRUEBA 6: Currency manipulada ---
    print("\n--- PRUEBA 6: Currency manipulada ---")
    payload = create_mock_webhook_payload(reference, amount, "USD", "APPROVED", "w-1")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert "Data mismatch" in res.text
    
    # --- PRUEBA 7: Reference manipulada ---
    print("\n--- PRUEBA 7: Reference manipulada ---")
    payload = create_mock_webhook_payload("FAKE-REF", amount, currency, "APPROVED", "w-1")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert "Payment reference not found" in res.text
    
    # --- PRUEBA 3 y 1: Concurrencia REAL (Dos Webhooks APPROVED simultáneos) ---
    print("\n--- PRUEBA 3: Webhooks APPROVED simultáneos ---")
    provider_id = f"w-{uuid.uuid4().hex[:6]}"
    payload = create_mock_webhook_payload(reference, amount, currency, "APPROVED", provider_id)
    
    def send_webhook():
        return client.post("/subscription/webhook/wompi", json=payload)
        
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(send_webhook)
        future2 = executor.submit(send_webhook)
        
        res1 = future1.result()
        res2 = future2.result()
        
    print(f"Thread 1 Result: {res1.status_code}, {res1.text}")
    print(f"Thread 2 Result: {res2.status_code}, {res2.text}")
    
    assert res1.status_code == 200
    assert res2.status_code == 200
    
    # Validate DB state
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.reference == reference).first()
        sub = db.query(Subscription).filter(Subscription.id == sub_id).first()
        audits = db.query(AuditLog).filter(
            AuditLog.entity_type == "SUBSCRIPTION", 
            AuditLog.action == "SUBSCRIPTION_ACTIVATED"
        ).all()
        
        print(f"Payment Status: {payment.status.value}, Provider ID: {payment.provider_transaction_id}")
        assert payment.status.value == "APPROVED"
        assert payment.provider_transaction_id == provider_id
        
        print(f"Subscription Status: {sub.status.value}")
        assert sub.status.value == "ACTIVE"
        
        ends_at_after = sub.ends_at
        print(f"ends_at after: {ends_at_after}")
        
        # Verify exactly one extension
        # Since it's monthly, it should be exactly 30 days plus or minus a tiny delta
        if ends_at_before:
            delta = ends_at_after - ends_at_before
            print(f"Delta: {delta.days} days")
            assert delta.days in (29, 30, 31), f"Expected ~30 days, got {delta.days}"
        else:
            # First time activation, delta from starts_at
            delta = ends_at_after - sub.starts_at
            print(f"Delta from starts_at: {delta.days} days")
            assert delta.days in (29, 30, 31), f"Expected ~30 days, got {delta.days}"
            
        print(f"Number of activation audit logs: {len(audits)}")
        # Note: audits might include other test runs if DB is not wiped, so we should filter by gym_id
        gym_audits = [a for a in audits if a.gym_id == sub.gym_id]
        print(f"Activation audit logs for this gym: {len(gym_audits)}")
        assert len(gym_audits) == 1, "There should be EXACTLY ONE activation audit log."
        
    finally:
        db.close()
        
    # --- PRUEBA 2: Webhook APPROVED duplicado secuencial ---
    print("\n--- PRUEBA 2: Webhook APPROVED duplicado secuencial ---")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert res.status_code == 200
    assert "Already processed" in res.text
    
    # --- PRUEBA 8: DECLINED (state regression test) ---
    print("\n--- PRUEBA 8: DECLINED on already APPROVED ---")
    payload = create_mock_webhook_payload(reference, amount, currency, "DECLINED", "w-1")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    assert res.status_code == 200
    assert "Payment already in final state" in res.text
    
    # Setup new payment for pure DECLINED/ERROR/VOIDED tests
    print("\nGenerating new payment for DECLINED test...")
    sub_id_2, payment_init_2 = setup_test_data()
    ref2 = payment_init_2["reference"]
    
    # --- PRUEBA 8: DECLINED (pure) ---
    print("\n--- PRUEBA 8: DECLINED (pure) ---")
    payload = create_mock_webhook_payload(ref2, amount, currency, "DECLINED", "w-2")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        p2 = db.query(SubscriptionPayment).filter(SubscriptionPayment.reference == ref2).first()
        s2 = db.query(Subscription).filter(Subscription.id == sub_id_2).first()
        print(f"Payment 2 Status: {p2.status.value}")
        print(f"Subscription 2 Status: {s2.status.value}")
        assert p2.status.value == "DECLINED"
        assert s2.status.value != "ACTIVE"
    finally:
        db.close()
        
    # Setup new payment 3
    sub_id_3, payment_init_3 = setup_test_data()
    ref3 = payment_init_3["reference"]
    
    # --- PRUEBA 9: ERROR (pure) ---
    print("\n--- PRUEBA 9: ERROR (pure) ---")
    payload = create_mock_webhook_payload(ref3, amount, currency, "ERROR", "w-3")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        p3 = db.query(SubscriptionPayment).filter(SubscriptionPayment.reference == ref3).first()
        s3 = db.query(Subscription).filter(Subscription.id == sub_id_3).first()
        assert p3.status.value == "ERROR"
        assert s3.status.value != "ACTIVE"
    finally:
        db.close()
        
    # Setup new payment 4
    sub_id_4, payment_init_4 = setup_test_data()
    ref4 = payment_init_4["reference"]
    
    # --- PRUEBA 10: VOIDED (pure) ---
    print("\n--- PRUEBA 10: VOIDED (pure) ---")
    payload = create_mock_webhook_payload(ref4, amount, currency, "VOIDED", "w-4")
    res = client.post("/subscription/webhook/wompi", json=payload)
    print(f"Result: {res.status_code}, {res.text}")
    db = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        p4 = db.query(SubscriptionPayment).filter(SubscriptionPayment.reference == ref4).first()
        s4 = db.query(Subscription).filter(Subscription.id == sub_id_4).first()
        assert p4.status.value == "VOIDED"
        assert s4.status.value != "ACTIVE"
    finally:
        db.close()

    print("\n=== TODOS LOS TESTS PASARON CORRECTAMENTE ===")

if __name__ == "__main__":
    run_tests()
