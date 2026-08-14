import sys
import os
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal

client = TestClient(app)

def run_tests():
    run_id = uuid.uuid4().hex[:6]
    
    email_a = f"admin_a_22_{run_id}@test.com"
    email_b = f"admin_b_22_{run_id}@test.com"
    
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
    
    # --- TEST A: CREAR Y CONSULTAR NOTIFICACIONES ---
    print("\n--- PRUEBA: CREAR NOTIFICACION MANUAL ---")
    res_send = client.post("/notifications/send", headers=headers_a, json={
        "client_id": None,
        "event_type": "GENERAL",
        "channel": "WHATSAPP",
        "recipient": "+573000000000",
        "message_body": "Prueba de notificacion"
    })
    
    if res_send.status_code == 202:
        notif_id = res_send.json()["id"]
        print(f"   => Notificacion Creada OK. ID: {notif_id}, Status: {res_send.json()['status']}")
        
        # Consultar
        res_get = client.get("/notifications/", headers=headers_a)
        assert res_get.status_code == 200
        print(f"   => Lista OK. Total Items: {res_get.json()['total']}")
        
        # Isolation
        print("\n--- PRUEBA: AISLAMIENTO TENANT B ---")
        res_get_b = client.get("/notifications/", headers=headers_b)
        assert res_get_b.status_code == 200
        print(f"   => Lista Tenant B OK. Total Items: {res_get_b.json()['total']}")
        assert res_get_b.json()['total'] == 0, "Fallo aislamiento"
    else:
        print(f"   => ERROR: {res_send.status_code} - {res_send.text}")
        
    print("\n=== PRUEBAS FUNCIONALES COMPLETADAS ===")

if __name__ == "__main__":
    run_tests()
