import sys
sys.path.append('.')
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from sqlalchemy import text
import uuid

client = TestClient(app)

def create_tenant(email, password, gym_name):
    res = client.post("/auth/register", json={
        "owner_name": f"Owner {gym_name}",
        "owner_email": email,
        "owner_password": password,
        "gym_name": gym_name
    })
    return res

def login(email, password):
    res = client.post("/auth/login", data={"username": email, "password": password})
    if res.status_code != 200:
        print("Login failed:", res.json())
    return res.json().get("access_token")

def run_tests():
    print("=== STARTING RLS / MULTI-TENANT TESTS ===")
    
    uid_a = str(uuid.uuid4())[:8]
    uid_b = str(uuid.uuid4())[:8]
    email_a = f"a_{uid_a}@test.com"
    email_b = f"b_{uid_b}@test.com"
    
    # 1. Register Tenant A
    res_a = create_tenant(email_a, "Password123!", f"Gym A {uid_a}")
    print("Register A:", res_a.status_code)
    if res_a.status_code != 201: print(res_a.json())
    
    # 2. Register Tenant B
    res_b = create_tenant(email_b, "Password123!", f"Gym B {uid_b}")
    print("Register B:", res_b.status_code)
    
    token_a = login(email_a, "Password123!")
    token_b = login(email_b, "Password123!")
    
    # Removed jwt decode
    
    # Activate subscriptions manually to pass SubscriptionGuard
    db = SessionLocal()
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    user_a = db.query(User).filter(User.email == email_a).first()
    user_b = db.query(User).filter(User.email == email_b).first()
    gym_a_id = user_a.gym_id
    gym_b_id = user_b.gym_id
    
    # We need to create active subscriptions for them
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    db.execute(text("INSERT INTO subscriptions (gym_id, plan_id, status, starts_at, ends_at, is_lifetime) VALUES (:g1, 1, 'ACTIVE', NOW(), NOW() + interval '30 days', false)"), {"g1": str(gym_a_id)})
    db.execute(text("INSERT INTO subscriptions (gym_id, plan_id, status, starts_at, ends_at, is_lifetime) VALUES (:g2, 1, 'ACTIVE', NOW(), NOW() + interval '30 days', false)"), {"g2": str(gym_b_id)})
    db.commit()
    
    # 3. Create client in Gym A
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res_client_a = client.post("/clients/", json={
        "document_type": "CC",
        "document": "111",
        "full_name": "Client A",
        "email": "client_a@test.com",
        "phone": "111",
        "is_active": True
    }, headers=headers_a)
    print("Create Client A:", res_client_a.status_code)
    
    # Check if client was created
    if res_client_a.status_code == 200:
        client_id_a = res_client_a.json()["id"]
        
        # 4. Cross-tenant read (IDOR)
        headers_b = {"Authorization": f"Bearer {token_b}"}
        res_read_a_from_b = client.get(f"/clients/{client_id_a}", headers=headers_b)
        print("Read Client A from Gym B (Should be 404/403):", res_read_a_from_b.status_code)
        
        # 5. Direct RLS validation on database
        db = SessionLocal()
        # Find gym_ids
        user_a = db.query(User).filter(User.email == "a@test.com").first()
        user_b = db.query(User).filter(User.email == "b@test.com").first()
        gym_a_id = user_a.gym_id
        gym_b_id = user_b.gym_id
        
        # Try to execute a raw SQL bypass using context B
        print("Testing Raw SQL RLS Context A...")
        db.execute(text("SELECT set_config('app.current_gym_id', :gym, true)"), {"gym": str(gym_a_id)})
        count_a = db.execute(text("SELECT COUNT(*) FROM clients")).scalar()
        print("Clients visible to Gym A:", count_a)
        
        print("Testing Raw SQL RLS Context B...")
        db.execute(text("SELECT set_config('app.current_gym_id', :gym, true)"), {"gym": str(gym_b_id)})
        count_b = db.execute(text("SELECT COUNT(*) FROM clients")).scalar()
        print("Clients visible to Gym B:", count_b)
        
        # 6. Try to INSERT as B but set gym_id = A
        try:
            db.execute(text("INSERT INTO clients (gym_id, first_name, last_name, document, is_active) VALUES (:gym, 'Hacker', 'B', '999', true)"), {"gym": str(gym_a_id)})
            db.commit()
            print("INSERT cross-tenant SUCCEEDED (VULNERABLE!)")
        except Exception as e:
            db.rollback()
            print("INSERT cross-tenant FAILED (SECURE):", type(e).__name__)
        
        db.close()
        
    else:
        print("Failed to create Client A:", res_client_a.json())

if __name__ == "__main__":
    run_tests()
