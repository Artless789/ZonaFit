import requests
import uuid

API_URL = "http://localhost:8000"

def run_tests():
    print("Iniciando pruebas Superadmin (Bloque 31)...\n")

    # 1. Login as Superadmin
    # First we need to make sure superadmin exists, we can use create_superadmin script but let's assume admin@zonafit.com exists
    print("[TEST] Login como Superadmin...")
    resp = requests.post(f"{API_URL}/auth/login", data={"username": "admin@zonafit.com", "password": "adminpassword"})
    if resp.status_code != 200:
        print("FAIL: No se pudo hacer login como superadmin")
        return
    sa_token = resp.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}
    print("PASS: Superadmin login exitoso.\n")

    # 2. Create Plan
    print("[TEST] Creando 'Plan Oro'...")
    plan_slug = f"plan-oro-{uuid.uuid4().hex[:6]}"
    plan_data = {
        "name": "Plan Oro",
        "slug": plan_slug,
        "description": "El mejor plan de la plataforma",
        "price": 150000,
        "currency": "COP",
        "billing_interval": "MONTHLY",
        "is_active": True
    }
    resp = requests.post(f"{API_URL}/superadmin/plans", json=plan_data, headers=sa_headers)
    if resp.status_code != 201:
        print(f"FAIL: Error al crear plan: {resp.text}")
        return
    plan_id = resp.json()["id"]
    print(f"PASS: Plan creado con ID {plan_id}.\n")

    # 3. Edit Plan Price (150000 -> 200000)
    print("[TEST] Editando precio a 200000...")
    update_data = {"price": 200000}
    resp = requests.put(f"{API_URL}/superadmin/plans/{plan_id}", json=update_data, headers=sa_headers)
    if resp.status_code != 200 or resp.json()["price"] != 200000:
        print(f"FAIL: Error al editar plan: {resp.text}")
        return
    print("PASS: Precio actualizado a 200000.\n")

    # 4. Deactivate Plan
    print("[TEST] Desactivando Plan...")
    update_data = {"is_active": False}
    resp = requests.put(f"{API_URL}/superadmin/plans/{plan_id}", json=update_data, headers=sa_headers)
    if resp.status_code != 200 or resp.json()["is_active"] != False:
        print(f"FAIL: Error al desactivar plan: {resp.text}")
        return
    print("PASS: Plan desactivado correctamente.\n")

    # 5. Verify Owner cannot see deactivated plans
    print("[TEST] Verificando visibilidad como OWNER...")
    # Register a temporary owner to get an owner token
    owner_email = f"owner_sa_test_{uuid.uuid4().hex[:6]}@zonafit.com"
    reg_resp = requests.post(f"{API_URL}/auth/register", json={
        "email": owner_email,
        "password": "Password123!",
        "full_name": "Test Owner",
        "gym_name": "Test Gym SA"
    })
    
    login_resp = requests.post(f"{API_URL}/auth/login", data={"username": owner_email, "password": "Password123!"})
    owner_token = login_resp.json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # Fetch available plans for checkout
    resp = requests.get(f"{API_URL}/subscription/plans", headers=owner_headers)
    available_plans = resp.json()
    
    found = any(p["id"] == plan_id for p in available_plans)
    if found:
        print("FAIL: El OWNER puede ver un plan inactivo.")
        return
    else:
        print("PASS: El OWNER no recibe planes inactivos en Checkout.\n")

    print("¡Todas las pruebas del SUPERADMIN pasaron exitosamente!")

if __name__ == "__main__":
    run_tests()
