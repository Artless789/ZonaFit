import sys
import os
import uuid
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal

client = TestClient(app)

def run_tests():
    run_id = uuid.uuid4().hex[:6]
    
    email_a = f"owner_a_21_{run_id}@test.com"
    email_b = f"owner_b_21_{run_id}@test.com"
    
    # --- SETUP TENANTS ---
    client.post("/auth/register", json={
        "owner_name": "Owner A", "owner_email": email_a, "owner_password": "Password123!",
        "gym_name": f"Gym A {run_id}", "gym_phone": "11111111", "gym_address": "St A", "gym_city": "City A"
    })
    client.post("/auth/register", json={
        "owner_name": "Owner B", "owner_email": email_b, "owner_password": "Password123!",
        "gym_name": f"Gym B {run_id}", "gym_phone": "22222222", "gym_address": "St B", "gym_city": "City B"
    })
    
    # --- SETUP SUBSCRIPTIONS ---
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
    
    # --- SETUP DATOS (CLIENTE, PRODUCTO, INVENTARIO) ---
    res_cli = client.post("/clients/", headers=headers_a, json={
        "full_name": "Cliente Factura", "document_type": "CC", "document": "777", "phone": "300"
    })
    client_id = res_cli.json()["id"]
    
    res_cat = client.post("/categories/", headers=headers_a, json={"name": "Accesorios"})
    cat_id = res_cat.json().get("id", 1)
    
    res_prod = client.post("/products/", headers=headers_a, json={
        "category_id": cat_id,
        "name": "Toalla",
        "sku": f"TOWEL-{run_id}",
        "purchase_price": 5000,
        "sale_price": 12000,
        "stock": 0,
        "minimum_stock": 10
    })
    prod_id = res_prod.json()["id"]
    
    client.post("/inventory-movements/", headers=headers_a, json={
        "product_id": prod_id, "movement_type": "IN", "quantity": 50, "reason": "Stock inicial"
    })
    
    # --- PRUEBA: CREAR VENTA REAL ---
    res_sale = client.post("/sales/", headers=headers_a, json={"client_id": client_id})
    sale_id = res_sale.json()["id"]
    client.post("/sale-details/", headers=headers_a, json={"sale_id": sale_id, "product_id": prod_id, "quantity": 2})
    res_sale_comp = client.post(f"/sales/{sale_id}/complete", headers=headers_a)
    sale_total = res_sale_comp.json()["total"]
    print(f"\n=> Venta Completada OK. Total Venta: {sale_total}")
    
    # --- TEST A: FACTURA ---
    print("\n--- PRUEBA: FACTURACIÓN ---")
    res_inv = client.post("/invoices/", headers=headers_a, json={"sale_id": sale_id})
    if res_inv.status_code == 201:
        inv_id = res_inv.json()["id"]
        inv_total = res_inv.json()["total"]
        print(f"   => Factura Creada OK. ID: {inv_id}, Total Factura: {inv_total}")
        
        # Test duplicidad
        res_inv2 = client.post("/invoices/", headers=headers_a, json={"sale_id": sale_id})
        if res_inv2.status_code == 201:
            print("   => FAIL: El sistema permitió crear facturas duplicadas para la misma venta (Unicidad no contemplada).")
        else:
            print(f"   => PASS: Factura duplicada rechazada ({res_inv2.status_code}).")
    elif res_inv.status_code == 404:
        print(f"   => ERROR: /invoices/ endpoint existia pero algo falló {res_inv.text}")
    else:
        print(f"   => ERROR en creacion de factura: {res_inv.status_code} - {res_inv.text}")
    
    # --- TEST B: REPORTES Y DASHBOARD ---
    print("\n--- PRUEBA: REPORTES Y DASHBOARD ---")
    # Dashboard
    res_dash = client.get("/dashboard/", headers=headers_a)
    if res_dash.status_code == 200:
        dash_data = res_dash.json()
        print(f"   => Dashboard A OK. total_sales: {dash_data.get('total_sales')}, total_income: {dash_data.get('total_income')}")
    else:
        print(f"   => ERROR Dashboard A: {res_dash.status_code}")
        
    # Reports
    res_rep = client.get("/reports/sales", headers=headers_a)
    if res_rep.status_code == 200:
        rep_data = res_rep.json()
        print(f"   => Reporte Ventas OK. total: {rep_data.get('total_sales')}, income: {rep_data.get('total_income')}")
    else:
        print(f"   => ERROR Reportes: {res_rep.status_code}")
    
    # Date Reports
    today = date.today()
    start_date = (today - timedelta(days=1)).isoformat()
    end_date = (today + timedelta(days=1)).isoformat()
    res_date = client.get(f"/reports/sales-by-date?start_date={start_date}&end_date={end_date}", headers=headers_a)
    if res_date.status_code == 200:
        print(f"   => Reporte Fechas OK.")
    else:
        print(f"   => ERROR Reporte Fechas: {res_date.status_code}")
        
    # --- TEST C: AISLAMIENTO MULTI-TENANT ---
    print("\n--- PRUEBA: AISLAMIENTO TENANT B ---")
    res_dash_b = client.get("/dashboard/", headers=headers_b)
    if res_dash_b.status_code == 200:
        dash_data_b = res_dash_b.json()
        print(f"   => Dashboard B OK. total_sales: {dash_data_b.get('total_sales')}, total_income: {dash_data_b.get('total_income')}")
        assert dash_data_b.get('total_sales', 0) == 0, "Aislamiento fallido en Dashboard B!"
    else:
        print(f"   => ERROR Dashboard B: {res_dash_b.status_code}")

    print("\n=== PRUEBAS FUNCIONALES COMPLETADAS ===")

if __name__ == "__main__":
    run_tests()
