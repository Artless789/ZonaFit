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
    
    email_a = f"owner_a_{run_id}@test.com"
    email_b = f"owner_b_{run_id}@test.com"
    
    # --- SETUP TENANTS ---
    client.post("/auth/register", json={
        "owner_name": "Owner A", "owner_email": email_a, "owner_password": "Password123!",
        "gym_name": f"Gym A {run_id}", "gym_phone": "11111111", "gym_address": "St A", "gym_city": "City A"
    })
    client.post("/auth/register", json={
        "owner_name": "Owner B", "owner_email": email_b, "owner_password": "Password123!",
        "gym_name": f"Gym B {run_id}", "gym_phone": "22222222", "gym_address": "St B", "gym_city": "City B"
    })
    
    # --- SETUP SUBSCRIPTIONS (Para pasar SubscriptionGuard) ---
    def add_subscription(email):
        # We need a direct DB session to add a subscription
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
                    plan_id=1,  # dummy
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
    
    # --- TEST A: CLIENTS ---
    print("\n--- PRUEBA: CLIENTES ---")
    print("Creando cliente Tenant A...")
    res_cli = client.post("/clients/", headers=headers_a, json={
        "full_name": "Juan Perez",
        "document_type": "CC",
        "document": "12345678",
        "phone": "3001234567"
    })
    assert res_cli.status_code == 201, f"Error creando cliente: {res_cli.text}"
    client_a_id = res_cli.json()["id"]
    print(f"   => Cliente Creado OK. ID: {client_a_id}")
    
    print("Consultando cliente Tenant A...")
    res_get_cli = client.get(f"/clients/{client_a_id}", headers=headers_a)
    assert res_get_cli.status_code == 200
    print("   => Cliente Consultado OK.")
    
    print("Actualizando cliente Tenant A...")
    res_upd_cli = client.put(f"/clients/{client_a_id}", headers=headers_a, json={"notes": "Cliente VIP"})
    assert res_upd_cli.status_code == 200
    assert res_upd_cli.json()["notes"] == "Cliente VIP"
    print("   => Cliente Actualizado OK.")
    
    # --- TEST B: MEMBERSHIP PLANS ---
    print("\n--- PRUEBA: PLANES DE MEMBRESÍA ---")
    print("Creando plan Tenant A...")
    res_plan = client.post("/membership-plans/", headers=headers_a, json={
        "name": "Plan Anual",
        "description": "Acceso ilimitado por un año",
        "duration_days": 365,
        "price": 1200000
    })
    if res_plan.status_code != 201:
        print(f"Error creando plan: {res_plan.text}")
    assert res_plan.status_code == 201
    plan_a_id = res_plan.json()["id"]
    print(f"   => Plan Creado OK. ID: {plan_a_id}")
    
    print("Consultando plan Tenant A...")
    res_get_plan = client.get(f"/membership-plans/{plan_a_id}", headers=headers_a)
    assert res_get_plan.status_code == 200
    print("   => Plan Consultado OK.")
    
    # --- TEST C: MEMBERSHIPS ---
    print("\n--- PRUEBA: MEMBRESÍAS DE CLIENTES ---")
    print("Asignando membresía al cliente Tenant A...")
    res_mem = client.post("/memberships/", headers=headers_a, json={
        "client_id": client_a_id,
        "membership_plan_id": plan_a_id
    })
    if res_mem.status_code != 201:
        print(f"Error creando membresía: {res_mem.text}")
    assert res_mem.status_code == 201
    mem_a_id = res_mem.json()["id"]
    print(f"   => Membresía Creada OK. ID: {mem_a_id}, Estado: {res_mem.json()['status']}")
    
    print("Consultando membresía Tenant A...")
    res_get_mem = client.get(f"/memberships/{mem_a_id}", headers=headers_a)
    assert res_get_mem.status_code == 200
    print("   => Membresía Consultada OK.")
    
    # --- TEST D: MULTI-TENANT ISOLATION ---
    print("\n--- PRUEBA: AISLAMIENTO MULTI-TENANT ---")
    print("Tenant B intenta acceder al cliente de Tenant A...")
    res_iso_cli = client.get(f"/clients/{client_a_id}", headers=headers_b)
    assert res_iso_cli.status_code == 404, "Fallo de seguridad: B pudo acceder al cliente de A"
    print("   => Acceso Bloqueado OK.")
    
    print("Tenant B intenta acceder a la membresía de Tenant A...")
    res_iso_mem = client.get(f"/memberships/{mem_a_id}", headers=headers_b)
    assert res_iso_mem.status_code == 404, "Fallo de seguridad: B pudo acceder a la membresía de A"
    print("   => Acceso Bloqueado OK.")
    
    print("\n=== TODAS LAS PRUEBAS FUNCIONALES PASARON CORRECTAMENTE ===")

if __name__ == "__main__":
    run_tests()
