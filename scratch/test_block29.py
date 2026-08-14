import requests
import uuid

BASE_URL = "http://localhost:8000"

def run_tests():
    print("Iniciando pruebas del Flujo Comercial (Bloque 29)...")

    # TEST 1: Registro de Gym nuevo
    unique_id = uuid.uuid4().hex[:8]
    email = f"owner_{unique_id}@zonafit.com"
    password = "password123"

    print(f"\n[TEST 01] Registrando gimnasio con email: {email}")
    register_payload = {
        "gym_name": f"Gym Test {unique_id}",
        "gym_legal_name": f"Legal Gym {unique_id} SAS",
        "gym_phone": "1234567890",
        "gym_address": "Calle 123",
        "gym_city": "Bogota",
        "owner_name": f"Owner {unique_id}",
        "owner_email": email,
        "owner_password": password
    }

    resp = requests.post(f"{BASE_URL}/auth/register", json=register_payload)
    if resp.status_code != 201:
        print(f"FAIL: Registro falló. Status: {resp.status_code}, Detalle: {resp.text}")
        return
    print("PASS: Registro exitoso.")

    # Login para obtener el token
    print(f"\n[TEST] Haciendo Login...")
    login_payload = {
        "username": email,
        "password": password
    }
    resp = requests.post(f"{BASE_URL}/auth/login", data=login_payload)
    if resp.status_code != 200:
        print(f"FAIL: Login falló. Status: {resp.status_code}")
        return
    token = resp.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print("PASS: Login exitoso.")

    # TEST 3: GET /subscription/me
    print(f"\n[TEST 03] Consultando suscripción...")
    resp = requests.get(f"{BASE_URL}/subscription/me", headers=headers)
    if resp.status_code != 200:
        print(f"FAIL: /subscription/me falló. Status: {resp.status_code}, Detalle: {resp.text}")
        return
    
    sub = resp.json()
    print(f"Subscripción encontrada: ID={sub.get('id')}, Status={sub.get('status')}, Plan ID={sub.get('plan_id')}")
    if sub.get('status') != "TRIAL" or sub.get('plan_id') is not None:
        print(f"FAIL: La suscripción no es TRIAL o el plan_id no es nulo.")
        return
    print("PASS: Suscripción es TRIAL sin plan asignado.")
    sub_id = sub.get("id")

    # TEST 4: GET /subscription/plans
    print(f"\n[TEST 04] Consultando planes activos...")
    resp = requests.get(f"{BASE_URL}/subscription/plans", headers=headers)
    if resp.status_code != 200:
        print(f"FAIL: /subscription/plans falló. Status: {resp.status_code}")
        return
    
    plans = resp.json()
    print(f"Planes encontrados: {len(plans)}")
    if len(plans) == 0:
        print("FAIL: No hay planes activos. No se puede continuar el pago.")
        return
    print("PASS: Planes obtenidos exitosamente.")

    # Elegimos el primer plan
    plan = plans[0]
    plan_id = plan.get("id")
    plan_price = plan.get("price")
    
    # TEST 5 & 6: Iniciar pago
    print(f"\n[TEST 06] Iniciando pago con plan_id={plan_id} (Precio={plan_price})...")
    payment_payload = {
        "plan_id": plan_id
    }
    resp = requests.post(f"{BASE_URL}/subscription/{sub_id}/payment", json=payment_payload, headers=headers)
    if resp.status_code != 200:
        print(f"FAIL: Inicialización de pago falló. Status: {resp.status_code}, Detalle: {resp.text}")
        return
    
    payment_info = resp.json()
    amount_in_cents = payment_info.get("amount_in_cents")
    signature = payment_info.get("signature")
    
    if not amount_in_cents or not signature:
        print("FAIL: Respuesta incompleta en init_payment.")
        return
        
    expected_cents = int(float(plan_price) * 100)
    if amount_in_cents != expected_cents:
        print(f"FAIL: Monto incorrecto. Esperado={expected_cents}, Recibido={amount_in_cents}")
        return
        
    print(f"PASS: Pago inicializado correctamente (Monto={amount_in_cents} centavos).")
    
    print("\n¡Todas las pruebas automáticas pasaron exitosamente!")

if __name__ == "__main__":
    run_tests()
