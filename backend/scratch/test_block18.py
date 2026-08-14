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
    
    # 1. Register Tenant A
    print("1. Registrando Tenant A...")
    res_reg_a = client.post("/auth/register", json={
        "owner_name": "Owner A",
        "owner_email": email_a,
        "owner_password": "Password123!",
        "gym_name": f"Gym A {run_id}",
        "gym_phone": "11111111",
        "gym_address": "Street A",
        "gym_city": "City A"
    })
    assert res_reg_a.status_code == 201, f"Registro A falló: {res_reg_a.text}"
    
    # 2. Register Tenant B
    print("2. Registrando Tenant B...")
    res_reg_b = client.post("/auth/register", json={
        "owner_name": "Owner B",
        "owner_email": email_b,
        "owner_password": "Password123!",
        "gym_name": f"Gym B {run_id}",
        "gym_phone": "22222222",
        "gym_address": "Street B",
        "gym_city": "City B"
    })
    assert res_reg_b.status_code == 201, f"Registro B falló: {res_reg_b.text}"
    
    # 3. Login Tenant A
    print("3. Haciendo Login Tenant A...")
    res_login_a = client.post("/auth/login", data={
        "username": email_a,
        "password": "Password123!"
    })
    assert res_login_a.status_code == 200, f"Login A falló: {res_login_a.text}"
    token_a = res_login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 4. Login Tenant B
    print("4. Haciendo Login Tenant B...")
    res_login_b = client.post("/auth/login", data={
        "username": email_b,
        "password": "Password123!"
    })
    assert res_login_b.status_code == 200, f"Login B falló: {res_login_b.text}"
    token_b = res_login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # 5. Obtener /auth/me para Tenant A
    print("5. Verificando /auth/me Tenant A...")
    res_me = client.get("/auth/me", headers=headers_a)
    assert res_me.status_code == 200
    data_me = res_me.json()
    assert data_me["email"] == email_a
    assert data_me["role"] == "OWNER"
    assert "gym_id" in data_me
    print(f"   => Identidad verificada. Role: {data_me['role']}, Gym ID: {data_me['gym_id']}")
    
    # 6. Consultar Configuración Tenant A
    print("6. Consultando Configuración Tenant A...")
    res_cfg_a = client.get("/gym-settings/", headers=headers_a)
    assert res_cfg_a.status_code == 200, f"Error obteniendo config: {res_cfg_a.text}"
    cfg_a = res_cfg_a.json()
    assert cfg_a["gym_id"] == data_me["gym_id"]
    print(f"   => Config consultada exitosamente. Legal name: {cfg_a['legal_name']}")
    
    # 7. Actualizar Configuración Tenant A
    print("7. Actualizando Configuración Tenant A...")
    res_upd_a = client.put("/gym-settings/", headers=headers_a, json={
        "tax_id": "NIT-900800700-1",
        "receipt_footer_notes": "Gracias por su preferencia"
    })
    assert res_upd_a.status_code == 200, f"Error actualizando config: {res_upd_a.text}"
    upd_cfg_a = res_upd_a.json()
    assert upd_cfg_a["tax_id"] == "NIT-900800700-1"
    assert upd_cfg_a["receipt_footer_notes"] == "Gracias por su preferencia"
    print("   => Actualización exitosa y campos guardados.")
    
    # 8. Verificar persistencia de actualización consultando de nuevo
    print("8. Verificando persistencia...")
    res_persist = client.get("/gym-settings/", headers=headers_a)
    assert res_persist.json()["tax_id"] == "NIT-900800700-1"
    print("   => Persistencia verificada.")
    
    # 9. Aislamiento Multi-Tenant (B intenta ver la config de A - En este caso, B llama al MISMO endpoint de A)
    # Como el endpoint usa `get_by_gym_id(db, current_user)`, B sólo debería ver su PROPIA configuración.
    # Así que verificaremos que la config que obtiene B NO sea la misma de A.
    print("9. Verificando aislamiento de Tenant B...")
    res_cfg_b = client.get("/gym-settings/", headers=headers_b)
    assert res_cfg_b.status_code == 200
    cfg_b = res_cfg_b.json()
    assert cfg_b["gym_id"] != cfg_a["gym_id"]
    assert cfg_b["tax_id"] != "NIT-900800700-1"
    print(f"   => Aislamiento exitoso. Tenant B obtuvo su propia configuración (Gym ID: {cfg_b['gym_id']}).")
    
    print("\n=== TODAS LAS PRUEBAS FUNCIONALES PASARON CORRECTAMENTE ===")

if __name__ == "__main__":
    run_tests()
