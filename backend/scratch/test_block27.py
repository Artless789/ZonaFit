import sys
import os
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    run_id = uuid.uuid4().hex[:6]
    email = f"test_{run_id}@zonafit.com"
    password = "SecurePassword123!"
    
    print("\n--- PRUEBA: REGISTRO ---")
    res_reg = client.post("/auth/register", json={
        "owner_name": "Test Owner",
        "owner_email": email,
        "owner_password": password,
        "gym_name": f"Gym {run_id}",
        "gym_phone": "12345678",
        "gym_address": "Test Ave",
        "gym_city": "Test City"
    })
    
    if res_reg.status_code == 201:
        print("   => Registro PASS")
    else:
        print("   => Registro FAIL", res_reg.status_code, res_reg.text)
        return
        
    print("\n--- PRUEBA: LOGIN ---")
    res_login = client.post("/auth/login", data={"username": email, "password": password})
    if res_login.status_code == 200:
        print("   => Login PASS")
        token = res_login.json().get("access_token")
    else:
        print("   => Login FAIL", res_login.status_code, res_login.text)
        return
        
    print("\n--- PRUEBA: ENDPOINTS PROTEGIDOS ---")
    headers = {"Authorization": f"Bearer {token}"}
    
    res_me = client.get("/auth/me", headers=headers)
    if res_me.status_code == 200:
        print("   => /auth/me PASS", res_me.json())
    else:
        print("   => /auth/me FAIL", res_me.status_code, res_me.text)
        return
        
    res_dashboard = client.get("/dashboard/kpis", headers=headers)
    if res_dashboard.status_code == 200:
        print("   => /dashboard/kpis PASS", res_dashboard.json())
    else:
        # Dashboard may return 403 if onboarding not completed or subscription required? Let's check.
        # But wait, subscription requirement is bypassed if gym is in trial? Let's see what happens.
        print("   => /dashboard/kpis returned", res_dashboard.status_code, res_dashboard.text)

if __name__ == "__main__":
    run_tests()
