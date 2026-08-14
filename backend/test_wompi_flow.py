import hashlib
import time
import uuid
import copy

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.database import SessionLocal
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.gym import Gym
from app.models.user import User
from app.core.config import settings
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    db = SessionLocal()
    
    # 1. Setup Test Data
    print("Setting up test data...")
    gym = db.query(Gym).first()
    if not gym:
        gym = Gym(name="Test Gym Wompi", document_number="123456789", address="Test", phone="123")
        db.add(gym)
        db.commit()
        
    plan = db.query(Plan).first()
    if not plan:
        plan = Plan(name="Test Plan", slug="test-plan", price=100.00, currency="COP", billing_interval="MONTHLY")
        db.add(plan)
        db.commit()
        
    sub = db.query(Subscription).filter(Subscription.gym_id == gym.id).first()
    if not sub:
        sub = Subscription(gym_id=gym.id, plan_id=plan.id, status="TRIAL")
        db.add(sub)
        db.commit()
        
    user = db.query(User).filter(User.gym_id == gym.id).first()
    if not user:
        user = User(email="wompi_test@zonafit.co", hashed_password="xxx", role="OWNER", gym_id=gym.id)
        db.add(user)
        db.commit()

    print(f"Gym ID: {gym.id}, Plan ID: {plan.id}, Sub ID: {sub.id}")

    # 3. Iniciar pago (simulando backend interno o request)
    # Ya que no tenemos el token JWT aquí fácilmente, vamos a simular lo que haría el endpoint:
    amount_in_cents = int(plan.price * 100)
    currency = plan.currency
    unique_ref = f"ZF-SUB-{sub.id}-{uuid.uuid4().hex[:8].upper()}"
    
    payment = SubscriptionPayment(
        gym_id=gym.id,
        subscription_id=sub.id,
        reference=unique_ref,
        amount_in_cents=amount_in_cents,
        currency=currency,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    print(f"4. Payment created and PENDING. Ref: {unique_ref}")
    print(f"5. Monto: {payment.amount_in_cents}")
    print(f"6. Currency: {payment.currency}")
    print(f"7. Reference: {payment.reference}")

    # 8. Evento APPROVED válido
    timestamp = str(int(time.time()))
    provider_id = f"trn_{uuid.uuid4().hex[:8]}"
    
    # Checksum properties
    # Wompi checksum calculates based on properties array
    properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
    data = {
        "transaction": {
            "id": provider_id,
            "status": "APPROVED",
            "amount_in_cents": amount_in_cents,
            "reference": unique_ref,
            "currency": currency,
        }
    }
    
    # Calculate checksum
    concatenated = str(data["transaction"]["id"]) + str(data["transaction"]["status"]) + str(data["transaction"]["amount_in_cents"])
    concatenated += timestamp
    concatenated += settings.WOMPI_EVENTS_SECRET
    
    checksum = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
    
    payload = {
        "event": "transaction.updated",
        "data": data,
        "environment": "test",
        "signature": {
            "properties": properties,
            "checksum": checksum
        },
        "timestamp": timestamp
    }
    
    print("Sending APPROVED webhook...")
    response = client.post("/subscription/webhook/wompi", json=payload)
    print("Response:", response.status_code, response.json())
    
    db.refresh(payment)
    db.refresh(sub)
    print(f"9. Subscription status after APPROVED: {sub.status}, Payment status: {payment.status}")
    
    # 10. Evento DECLINED válido
    print("Testing DECLINED event...")
    # Crear otro pago
    unique_ref_2 = f"ZF-SUB-{sub.id}-{uuid.uuid4().hex[:8].upper()}"
    payment2 = SubscriptionPayment(
        gym_id=gym.id, subscription_id=sub.id, reference=unique_ref_2,
        amount_in_cents=amount_in_cents, currency=currency
    )
    db.add(payment2)
    db.commit()
    
    provider_id_2 = f"trn_{uuid.uuid4().hex[:8]}"
    data2 = copy.deepcopy(data)
    data2["transaction"]["id"] = provider_id_2
    data2["transaction"]["status"] = "DECLINED"
    data2["transaction"]["reference"] = unique_ref_2
    
    concat2 = str(provider_id_2) + "DECLINED" + str(amount_in_cents) + timestamp + settings.WOMPI_EVENTS_SECRET
    checksum2 = hashlib.sha256(concat2.encode('utf-8')).hexdigest()
    
    payload2 = copy.deepcopy(payload)
    payload2["data"] = data2
    payload2["signature"]["checksum"] = checksum2
    
    response = client.post("/subscription/webhook/wompi", json=payload2)
    db.refresh(payment2)
    db.refresh(sub)
    print(f"11. Subscription status after DECLINED: {sub.status}, Payment2 status: {payment2.status}")
    
    # 14. Webhook con checksum inválido
    print("Testing Invalid Checksum...")
    payload3 = copy.deepcopy(payload2)
    payload3["signature"]["checksum"] = "invalid_hash_123"
    response = client.post("/subscription/webhook/wompi", json=payload3)
    print("Response Invalid Checksum:", response.status_code, response.json())

    # 15. Webhook duplicado
    print("Testing duplicated webhook...")
    response = client.post("/subscription/webhook/wompi", json=payload)
    print("Response Duplicated:", response.status_code, response.json())
    
    # 18. Monto incorrecto
    print("Testing Invalid Amount...")
    data_inv = copy.deepcopy(data)
    data_inv["transaction"]["amount_in_cents"] = 999999
    # recalculate checksum for the invalid payload
    concat_inv = str(data_inv["transaction"]["id"]) + str(data_inv["transaction"]["status"]) + str(data_inv["transaction"]["amount_in_cents"]) + timestamp + settings.WOMPI_EVENTS_SECRET
    payload_inv = copy.deepcopy(payload)
    payload_inv["data"] = data_inv
    payload_inv["signature"]["checksum"] = hashlib.sha256(concat_inv.encode('utf-8')).hexdigest()
    
    response = client.post("/subscription/webhook/wompi", json=payload_inv)
    print("Response Invalid Amount:", response.status_code, response.json())
    
if __name__ == "__main__":
    run_tests()
