import sys
import os
import uuid
import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from scripts.cron_memberships import run_expiration_cron

client = TestClient(app)

def run_tests():
    run_id = uuid.uuid4().hex[:6]
    
    email_a = f"admin_a_23_{run_id}@test.com"
    email_b = f"admin_b_23_{run_id}@test.com"
    
    # --- SETUP TENANTS ---
    client.post("/auth/register", json={
        "owner_name": "Admin A", "owner_email": email_a, "owner_password": "Password123!",
        "gym_name": f"Gym A {run_id}", "gym_phone": "11111111", "gym_address": "St A", "gym_city": "City A"
    })
    client.post("/auth/register", json={
        "owner_name": "Admin B", "owner_email": email_b, "owner_password": "Password123!",
        "gym_name": f"Gym B {run_id}", "gym_phone": "22222222", "gym_address": "St B", "gym_city": "City B"
    })
    
    def add_subscription(email):
        db = SessionLocal()
        try:
            from app.models.user import User
            from app.models.subscription import Subscription
            from sqlalchemy import text
            db.info['bypass_rls'] = True
            db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            user = db.query(User).filter(User.email == email).first()
            if user:
                from datetime import datetime, timedelta
                sub = Subscription(
                    gym_id=user.gym_id,
                    plan_id=1,
                    status="ACTIVE",
                    starts_at=datetime.utcnow(),
                    ends_at=datetime.utcnow() + timedelta(days=365)
                )
                db.add(sub)
                db.commit()
        finally:
            db.close()
            
    add_subscription(email_a)
    add_subscription(email_b)
    
    token_a = client.post("/auth/login", data={"username": email_a, "password": "Password123!"}).json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    token_b = client.post("/auth/login", data={"username": email_b, "password": "Password123!"}).json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Enable notification templates
    client.post("/notification-templates/", headers=headers_a, json={
        "event_type": "MEMBERSHIP_EXPIRY", "channel": "WHATSAPP", "template_body": "Hi {client_name}, your membership at {gym_name} expires on {expiry_date}."
    })
    client.post("/notification-templates/", headers=headers_a, json={
        "event_type": "PAYMENT_RECEIVED", "channel": "WHATSAPP", "template_body": "Hi {client_name}, payment of {amount} received at {gym_name}."
    })

    # Add client A
    res_cli = client.post("/clients/", headers=headers_a, json={
        "full_name": "Test Client A",
        "document_type": "CC",
        "document": f"DOCA{run_id}",
        "phone": "+573001111111",
        "email": "clienta@test.com"
    })
    if res_cli.status_code != 201:
        print("CLIENT ERROR", res_cli.text)
    client_a_id = res_cli.json()["id"]

    # --- PRUEBA: EVENTO VENCIMIENTO ---
    print("\n--- PRUEBA: CRON VENCIMIENTO ---")
    # Add membership plan A
    res_plan = client.post("/membership-plans/", headers=headers_a, json={
        "name": "Plan A",
        "price": "100.00",
        "duration_days": 30
    })
    plan_a_id = res_plan.json()["id"]

    # Direct database insertion to mock expiration in 3 days
    db = SessionLocal()
    try:
        from app.models.user import User
        from app.models.membership import Membership
        from sqlalchemy import text
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        
        user_a = db.query(User).filter(User.email == email_a).first()
        target_date = datetime.datetime.now().date() + datetime.timedelta(days=3)
        
        mem = Membership(
            gym_id=user_a.gym_id,
            client_id=client_a_id,
            membership_plan_id=plan_a_id,
            start_date=datetime.datetime.now().date() - datetime.timedelta(days=27),
            end_date=target_date,
            price=100.00,
            status="ACTIVE"
        )
        db.add(mem)
        db.commit()
        db.refresh(mem)
        mem_id = mem.id
    finally:
        db.close()
        
    # RUN CRON
    run_expiration_cron(days_warning=3)
    
    # Check if notification was generated
    res_notifs = client.get("/notifications/?event_type=MEMBERSHIP_EXPIRY", headers=headers_a)
    notifs = res_notifs.json()["items"]
    if len(notifs) == 1:
        print("   => PASS: Comunicación de Vencimiento Generada")
        print("   => Mnsaje:", notifs[0]["message_body"])
    else:
        print("   => FAIL: No se generó la notificación de vencimiento")

    print("\n--- PRUEBA: IDEMPOTENCIA DE CRON ---")
    run_expiration_cron(days_warning=3) # run again
    res_notifs2 = client.get("/notifications/?event_type=MEMBERSHIP_EXPIRY", headers=headers_a)
    if len(res_notifs2.json()["items"]) == 1:
        print("   => PASS: No duplicación de Cron")
    else:
        print("   => FAIL: Se duplicó la notificación")

    # --- PRUEBA: EVENTO PAGO APROBADO ---
    print("\n--- PRUEBA: PAGO APROBADO ---")
    res_pay = client.post("/payments/", headers=headers_a, json={
        "membership_id": mem_id,
        "payment_method": "CASH",
        "reference": f"REF-{run_id}"
    })
    if res_pay.status_code == 201:
        res_notif_pay = client.get("/notifications/?event_type=PAYMENT_RECEIVED", headers=headers_a)
        notifs_p = res_notif_pay.json()["items"]
        if len(notifs_p) == 1:
            print("   => PASS: Comunicación de Pago Generada")
            print("   => Mensaje:", notifs_p[0]["message_body"])
        else:
            print("   => FAIL: No se generó la notificación de pago", len(notifs_p))
    else:
        print("   => FAIL: Falló creación del pago", res_pay.text)

    # Idempotencia pago (simulate double webhook or double insert)
    res_pay2 = client.post("/payments/", headers=headers_a, json={
        "membership_id": mem_id,
        "payment_method": "CASH",
        "reference": f"REF2-{run_id}"
    })
    if res_pay2.status_code == 201:
        res_notif_pay2 = client.get("/notifications/?event_type=PAYMENT_RECEIVED", headers=headers_a)
        if len(res_notif_pay2.json()["items"]) == 1:
            print("   => PASS: No duplicación de Pago")
        else:
            print("   => FAIL: Se duplicó la notificación de pago")
            
    # --- AISLAMIENTO TENANT B ---
    print("\n--- PRUEBA: AISLAMIENTO TENANT B ---")
    res_b = client.get("/notifications/", headers=headers_b)
    if res_b.json()["total"] == 0:
        print("   => PASS: Tenant B no ve notificaciones de Tenant A")
    else:
        print("   => FAIL: Aislamiento roto")

if __name__ == "__main__":
    run_tests()
