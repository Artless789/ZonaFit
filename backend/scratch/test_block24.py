import sys
import os
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    run_id = uuid.uuid4().hex[:6]
    email = f"admin_{run_id}@test.com"
    password = "Password123!"
    
    print("\n--- PRUEBA: REGISTRO Y LOGIN ---")
    res_reg = client.post("/auth/register", json={
        "owner_name": "Admin",
        "owner_email": email,
        "owner_password": password,
        "gym_name": f"Gym {run_id}",
        "gym_phone": "12345678",
        "gym_address": "St",
        "gym_city": "City"
    })
    
    if res_reg.status_code == 201:
        print("   => Registro PASS")
    else:
        print("   => Registro FAIL", res_reg.text)
        return
        
    res_login = client.post("/auth/login", data={"username": email, "password": password})
    if res_login.status_code == 200:
        print("   => Login PASS")
        token = res_login.json().get("access_token")
    else:
        print("   => Login FAIL", res_login.text)
        return
        
    print("\n--- PRUEBA: ENDPOINT PROTEGIDO ---")
    headers = {"Authorization": f"Bearer {token}"}
    res_me = client.get("/auth/me", headers=headers)
    if res_me.status_code == 200:
        print("   => Endpoint Protegido PASS")
        # Ensure password is not in response
        if "password" not in res_me.json():
            print("   => Password NOT exposed PASS")
        else:
            print("   => Password EXPOSED FAIL")
    else:
        print("   => Endpoint Protegido FAIL", res_me.text)

if __name__ == "__main__":
    run_tests()
