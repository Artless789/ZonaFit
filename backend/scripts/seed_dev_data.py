import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from sqlalchemy import text, func
from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.category import Category
from app.models.product import Product
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.accounts_receivable import AccountsReceivable
from app.core.security import hash_password

def seed_data():
    print("==================================================")
    print("   MERWIL ZONAFIT - DEV TEST DATA SEEDER (LOCAL)  ")
    print("==================================================")
    
    db: Session = SessionLocal()
    try:
        db.info['bypass_rls'] = True
        try:
            db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        except Exception:
            pass

        target_email = "papa@gmail.com"
        print(f"Buscando o configurando usuario: {target_email}")
        
        user = db.query(User).filter(func.lower(func.trim(User.email)) == target_email).first()
        if not user:
            print(f"Creando usuario {target_email}...")
            user = User(
                email=target_email,
                password=hash_password("password123"),
                full_name="Wilmer Moscote",
                role="OWNER"
            )
            db.add(user)
            db.flush()
        else:
            user.role = "OWNER"
            db.flush()

        print(f"Usuario OK: ID {user.id}, Nombre: {user.full_name}")

        # 1. Configurar Gimnasio
        gym = None
        if user.gym_id:
            gym = db.query(Gym).filter(Gym.id == user.gym_id).first()

        if not gym:
            gym = db.query(Gym).filter(Gym.email == target_email).first()

        if not gym:
            print("Creando gimnasio 'Merwil ZonaFit HQ'...")
            gym = Gym(
                name="Merwil ZonaFit HQ",
                email=target_email,
                phone="3001234567",
                address="Calle 50 # 13-45, Barranquilla",
                owner_id=user.id,
                is_active=True,
                onboarding_completed=True
            )
            db.add(gym)
            db.flush()
        else:
            gym.onboarding_completed = True
            gym.name = "Merwil ZonaFit HQ"
            db.flush()

        user.gym_id = gym.id
        db.flush()
        print(f"Gimnasio OK: ID {gym.id} - {gym.name}")

        # 2. Configurar GymSettings
        settings = db.query(GymSettings).filter(GymSettings.gym_id == gym.id).first()
        if not settings:
            print("Configurando GymSettings...")
            settings = GymSettings(
                gym_id=gym.id,
                legal_name="Merwil ZonaFit S.A.S.",
                trade_name="Merwil ZonaFit HQ",
                tax_id="901.452.889-1",
                tax_regime="Responsable de IVA",
                official_phone="3001234567",
                official_email=target_email,
                physical_address="Calle 50 # 13-45",
                city="Barranquilla",
                country="Colombia",
                currency="COP",
                timezone="America/Bogota",
                default_tax_percentage=0.00
            )
            db.add(settings)
            db.flush()
        print("GymSettings OK.")

        # 3. Membership Plans
        plans_data = [
            {"name": "Mensualidad Completa", "duration_days": 30, "price": 65000, "desc": "Acceso ilimitado 30 días"},
            {"name": "Plan Trimestral Pro", "duration_days": 90, "price": 180000, "desc": "Acceso ilimitado 90 días"},
            {"name": "Semestral Atleta", "duration_days": 180, "price": 330000, "desc": "Acceso ilimitado 180 días"},
            {"name": "Pase Diario", "duration_days": 1, "price": 10000, "desc": "Entrenamiento individual 1 día"}
        ]
        plan_objects = []
        for pdata in plans_data:
            p = db.query(MembershipPlan).filter(
                MembershipPlan.gym_id == gym.id,
                MembershipPlan.name == pdata["name"]
            ).first()
            if not p:
                p = MembershipPlan(
                    gym_id=gym.id,
                    name=pdata["name"],
                    duration_days=pdata["duration_days"],
                    price=pdata["price"],
                    description=pdata["desc"],
                    is_active=True
                )
                db.add(p)
                db.flush()
            plan_objects.append(p)
        print(f"Planes de membresía OK ({len(plan_objects)} planes).")

        # 4. Clientes
        clients_data = [
            {"name": "Carlos Mario Restrepo", "doc": "1045234567", "phone": "3004567890", "email": "carlos.restrepo@test.com"},
            {"name": "Valeria Gómez Ortiz", "doc": "1045234568", "phone": "3105678901", "email": "valeria.gomez@test.com"},
            {"name": "Andrés Felipe Morales", "doc": "1045234569", "phone": "3206789012", "email": "andres.morales@test.com"},
            {"name": "Daniela Sofia Castro", "doc": "1045234570", "phone": "3157890123", "email": "daniela.castro@test.com"},
            {"name": "Juan Camilo Herrera", "doc": "1045234571", "phone": "3018901234", "email": "juan.herrera@test.com"},
            {"name": "Mariana Lucía Pérez", "doc": "1045234572", "phone": "3129012345", "email": "mariana.perez@test.com"},
            {"name": "Mateo Alejandro Silva", "doc": "1045234573", "phone": "3180123456", "email": "mateo.silva@test.com"},
            {"name": "Isabella Ruiz Mendoza", "doc": "1045234574", "phone": "3051234567", "email": "isabella.ruiz@test.com"},
        ]
        client_objects = []
        for cdata in clients_data:
            c = db.query(Client).filter(
                Client.gym_id == gym.id,
                Client.document == cdata["doc"]
            ).first()
            if not c:
                c = Client(
                    gym_id=gym.id,
                    full_name=cdata["name"],
                    document_type="CC",
                    document=cdata["doc"],
                    phone=cdata["phone"],
                    email=cdata["email"],
                    is_active=True
                )
                db.add(c)
                db.flush()
            client_objects.append(c)
        print(f"Clientes OK ({len(client_objects)} clientes).")

        # 5. Membresías con estados requeridos
        now = datetime.now(timezone.utc)
        memberships_specs = [
            # 4 activas con vigencia amplia (+25 días)
            {"client": client_objects[0], "plan": plan_objects[0], "start": now - timedelta(days=5), "end": now + timedelta(days=25), "status": "ACTIVE"},
            {"client": client_objects[1], "plan": plan_objects[1], "start": now - timedelta(days=20), "end": now + timedelta(days=70), "status": "ACTIVE"},
            {"client": client_objects[2], "plan": plan_objects[0], "start": now - timedelta(days=10), "end": now + timedelta(days=20), "status": "ACTIVE"},
            {"client": client_objects[3], "plan": plan_objects[2], "start": now - timedelta(days=30), "end": now + timedelta(days=150), "status": "ACTIVE"},
            # 2 por vencer hoy (end date = today)
            {"client": client_objects[4], "plan": plan_objects[0], "start": now - timedelta(days=30), "end": now + timedelta(hours=4), "status": "ACTIVE"},
            {"client": client_objects[5], "plan": plan_objects[0], "start": now - timedelta(days=30), "end": now + timedelta(hours=8), "status": "ACTIVE"},
            # 2 por vencer en 3 días
            {"client": client_objects[6], "plan": plan_objects[0], "start": now - timedelta(days=27), "end": now + timedelta(days=3), "status": "ACTIVE"},
            {"client": client_objects[7], "plan": plan_objects[0], "start": now - timedelta(days=27), "end": now + timedelta(days=3), "status": "ACTIVE"},
        ]

        for spec in memberships_specs:
            existing_mem = db.query(Membership).filter(
                Membership.gym_id == gym.id,
                Membership.client_id == spec["client"].id
            ).first()
            if not existing_mem:
                mem = Membership(
                    gym_id=gym.id,
                    client_id=spec["client"].id,
                    membership_plan_id=spec["plan"].id,
                    start_date=spec["start"],
                    end_date=spec["end"],
                    price=spec["plan"].price,
                    base_price=spec["plan"].price,
                    discount=0,
                    status=spec["status"],
                    is_active=True
                )
                db.add(mem)
                db.flush()
        print("Membresías OK (activas, hoy y en 3 días).")

        # 6. Turno de Caja Abierto y Movimientos
        active_cr = db.query(CashRegister).filter(
            CashRegister.gym_id == gym.id,
            CashRegister.status == "OPEN"
        ).first()

        if not active_cr:
            print("Abriendo turno de caja activo...")
            active_cr = CashRegister(
                gym_id=gym.id,
                opened_by=user.id,
                opened_at=now - timedelta(hours=6),
                opening_balance=50000,
                status="OPEN"
            )
            db.add(active_cr)
            db.flush()

            # Movimientos iniciales de prueba
            mov1 = CashMovement(
                gym_id=gym.id,
                cash_register_id=active_cr.id,
                amount=65000,
                type="IN",
                category="SALE",
                description="Cobro en mostrador - Mensualidad",
                created_by=user.id
            )
            mov2 = CashMovement(
                gym_id=gym.id,
                cash_register_id=active_cr.id,
                amount=25000,
                type="IN",
                category="CREDIT_PAYMENT",
                description="Abono a cuenta por cobrar",
                created_by=user.id
            )
            db.add_all([mov1, mov2])
            db.flush()
        print(f"Caja OK: Turno #{active_cr.id} Abierto.")

        # 7. Categorías y Productos con stock normal y stock bajo
        cat1 = db.query(Category).filter(Category.gym_id == gym.id, Category.name == "Suplementos").first()
        if not cat1:
            cat1 = Category(gym_id=gym.id, name="Suplementos", description="Proteínas y aminoácidos")
            db.add(cat1)
            db.flush()

        cat2 = db.query(Category).filter(Category.gym_id == gym.id, Category.name == "Bebidas").first()
        if not cat2:
            cat2 = Category(gym_id=gym.id, name="Bebidas", description="Hidratación y energizantes")
            db.add(cat2)
            db.flush()

        products_data = [
            {"name": "Proteína Whey Gold 2lb", "sku": "SUP-001", "cat": cat1.id, "buy": 110000, "sale": 145000, "stock": 15, "min": 5},
            {"name": "Creatina Monohidratada 300g", "sku": "SUP-002", "cat": cat1.id, "buy": 70000, "sale": 95000, "stock": 18, "min": 5},
            {"name": "BCAA Aminoácidos 30 Serv", "sku": "SUP-003", "cat": cat1.id, "buy": 50000, "sale": 75000, "stock": 12, "min": 4},
            {"name": "Bebida Gatorade 500ml", "sku": "BEB-001", "cat": cat2.id, "buy": 3500, "sale": 5500, "stock": 35, "min": 10},
            # 2 productos con stock bajo (Stock < Min)
            {"name": "Barra de Proteína Crunch", "sku": "SNK-001", "cat": cat1.id, "buy": 5000, "sale": 8000, "stock": 2, "min": 8},
            {"name": "Agua Mineral 600ml", "sku": "BEB-002", "cat": cat2.id, "buy": 1500, "sale": 3000, "stock": 3, "min": 15},
        ]

        for pdata in products_data:
            p = db.query(Product).filter(Product.gym_id == gym.id, Product.sku == pdata["sku"]).first()
            if not p:
                p = Product(
                    gym_id=gym.id,
                    category_id=pdata["cat"],
                    name=pdata["name"],
                    sku=pdata["sku"],
                    purchase_price=pdata["buy"],
                    sale_price=pdata["sale"],
                    stock=pdata["stock"],
                    minimum_stock=pdata["min"],
                    is_active=True
                )
                db.add(p)
                db.flush()
        print(f"Productos OK ({len(products_data)} productos con stock y alertas de mínimo).")

        # 8. Cuentas por Cobrar (CxC): Activas vs Historial de Pagadas ($0)
        # Crédito 1: Activo con abono parcial
        sale1 = db.query(Sale).filter(Sale.gym_id == gym.id, Sale.notes == "Venta a crédito #1 (Parcial)").first()
        if not sale1:
            sale1 = Sale(
                gym_id=gym.id,
                client_id=client_objects[0].id,
                total=120000,
                status="COMPLETED",
                notes="Venta a crédito #1 (Parcial)",
                is_active=True
            )
            db.add(sale1)
            db.flush()

            ar1 = AccountsReceivable(
                gym_id=gym.id,
                client_id=client_objects[0].id,
                sale_id=sale1.id,
                original_amount=120000,
                paid_amount=40000,
                balance_due=80000,
                due_date=now + timedelta(days=7),
                status="PARTIAL",
                is_active=True
            )
            db.add(ar1)
            db.flush()

        # Crédito 2: Activo sin abonos
        sale2 = db.query(Sale).filter(Sale.gym_id == gym.id, Sale.notes == "Venta a crédito #2 (Pendiente)").first()
        if not sale2:
            sale2 = Sale(
                gym_id=gym.id,
                client_id=client_objects[6].id,
                total=65000,
                status="COMPLETED",
                notes="Venta a crédito #2 (Pendiente)",
                is_active=True
            )
            db.add(sale2)
            db.flush()

            ar2 = AccountsReceivable(
                gym_id=gym.id,
                client_id=client_objects[6].id,
                sale_id=sale2.id,
                original_amount=65000,
                paid_amount=0,
                balance_due=65000,
                due_date=now + timedelta(days=5),
                status="PENDING",
                is_active=True
            )
            db.add(ar2)
            db.flush()

        # Crédito 3: Pagado en su totalidad ($0 de saldo) -> HISTORIAL DE PAGADAS
        sale3 = db.query(Sale).filter(Sale.gym_id == gym.id, Sale.notes == "Venta a crédito #3 (Totalmente Pagada)").first()
        if not sale3:
            sale3 = Sale(
                gym_id=gym.id,
                client_id=client_objects[7].id,
                total=95000,
                status="COMPLETED",
                notes="Venta a crédito #3 (Totalmente Pagada)",
                is_active=True
            )
            db.add(sale3)
            db.flush()

            ar3 = AccountsReceivable(
                gym_id=gym.id,
                client_id=client_objects[7].id,
                sale_id=sale3.id,
                original_amount=95000,
                paid_amount=95000,
                balance_due=0,
                due_date=now - timedelta(days=2),
                status="PAID",
                is_active=True
            )
            db.add(ar3)
            db.flush()

        print("Cuentas por Cobrar OK (2 activas + 1 en historial de pagadas con saldo $0).")

        db.commit()
        print("\n==================================================")
        print("  SEED COMPLETADO CON ÉXITO PARA papa@gmail.com!   ")
        print("==================================================")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Error durante el seed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
