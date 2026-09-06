import sys
sys.path.insert(0, r"C:\Dev\ZonaFit\backend")
import os
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.database.database import SessionLocal
from app.models.user import User
from app.models.gym import Gym
from app.models.client import Client
from app.models.category import Category
from app.models.product import Product
from app.models.membership_plan import MembershipPlan
from app.models.membership import Membership
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.payment import Payment
from app.models.accounts_receivable import AccountsReceivable
from app.constants.sale_status import SaleStatus

db = SessionLocal()
db.info["bypass_rls"] = True

user = db.query(User).filter(User.email == "william@gmail.com").first()
if not user:
    print("Error: william@gmail.com not found!")
    exit(1)

gym_id = user.gym_id
print(f"Seeding for Gym ID {gym_id} (william@gmail.com)...")

# 1. First names and last names pool
FIRST_NAMES = [
    "Carlos", "Andres", "Juan", "David", "Santiago", "Mateo", "Sebastian", "Camilo",
    "Alejandro", "Nicolas", "Felipe", "Daniel", "Leonardo", "Diego", "Gabriel", "Cristian",
    "Julian", "Miguel", "Esteban", "Manuel", "Maria", "Valentina", "Camila", "Isabella",
    "Sofia", "Mariana", "Daniela", "Natalia", "Laura", "Paula", "Andrea", "Carolina",
    "Juliana", "Vanessa", "Sara", "Gabriela", "Alejandra", "Catalina", "Diana", "Tatiana",
    "Javier", "Oscar", "Rodrigo", "Alvaro", "Hector", "Ricardo", "Eduardo", "Ivan",
    "Fernando", "Mauricio", "Adriana", "Claudia", "Patricia", "Monica", "Gloria", "Sandra",
    "Marcela", "Lorena", "Liliana", "Esperanza", "Angela", "Rocio", "Ingrid", "Johana"
]

LAST_NAMES = [
    "Rodriguez", "Gomez", "Lopez", "Gonzalez", "Martinez", "Garcia", "Perez", "Sanchez",
    "Ramirez", "Torres", "Diaz", "Castro", "Vargas", "Morales", "Rojas", "Ortiz",
    "Silva", "Rios", "Moreno", "Gutierrez", "Jimenez", "Ruiz", "Hernandez", "Mejia",
    "Restrepo", "Ospina", "Bedoya", "Cardona", "Hurtado", "Caicedo", "Londono", "Palacio",
    "Gallego", "Duque", "Valencia", "Quintero", "Zapata", "Carvajal", "Henao", "Marin",
    "Cifuentes", "Mendoza", "Pelaez", "Guerrero", "Castillo", "Villada", "Agudelo", "Saldarriaga"
]

now = datetime.now(timezone.utc)

# 2. Add 150 Clients
existing_docs = set(d[0] for d in db.query(Client.document).filter(Client.gym_id == gym_id).all())
clients_added = 0
new_clients = []

random.seed(42)  # Deterministic seed

for i in range(1, 151):
    doc = f"1001{i:06d}"
    if doc in existing_docs:
        continue
    fn = random.choice(FIRST_NAMES)
    ln1 = random.choice(LAST_NAMES)
    ln2 = random.choice(LAST_NAMES)
    full_name = f"{fn} {ln1} {ln2}"
    phone_prefix = random.choice(["300", "310", "315", "320", "321", "301", "314", "318"])
    phone = f"{phone_prefix}{random.randint(1000000, 9999999)}"
    clean_name = f"{fn.lower()}.{ln1.lower()}{random.randint(10, 99)}"
    email = f"{clean_name}@gmail.com"
    
    # Creation dates spread over last 3 months
    days_ago = random.randint(1, 90)
    created_date = now - timedelta(days=days_ago, hours=random.randint(1, 12))
    
    client = Client(
        gym_id=gym_id,
        full_name=full_name,
        document_type="CC",
        document=doc,
        phone=phone,
        email=email,
        notes="Cliente regular" if random.random() > 0.3 else "Objetivo: hipertrofia y acondicionamiento",
        is_active=True,
        created_at=created_date
    )
    db.add(client)
    new_clients.append(client)
    clients_added += 1

db.flush()
print(f"Added {clients_added} new clients.")

# Get all clients for gym
all_clients = db.query(Client).filter(Client.gym_id == gym_id).all()
print(f"Total clients in gym: {len(all_clients)}")

# 3. Add Membership Plans if not exist
plans_data = [
    {"name": "Mensualidad", "price": Decimal("60000.00"), "duration_days": 30, "description": "Acceso libre durante 30 días"},
    {"name": "Quincenal", "price": Decimal("35000.00"), "duration_days": 15, "description": "Acceso libre durante 15 días"},
    {"name": "Trimestral", "price": Decimal("160000.00"), "duration_days": 90, "description": "Plan 3 meses con descuento"},
    {"name": "Semestral", "price": Decimal("300000.00"), "duration_days": 180, "description": "Plan 6 meses incluye valoración"},
    {"name": "Anual VIP", "price": Decimal("550000.00"), "duration_days": 365, "description": "Acceso ilimitado todo el año + locker"},
    {"name": "Pase Día", "price": Decimal("10000.00"), "duration_days": 1, "description": "Tiquete de 1 día de entrenamiento"},
]

plan_map = {}
for pd in plans_data:
    p = db.query(MembershipPlan).filter(MembershipPlan.gym_id == gym_id, MembershipPlan.name == pd["name"]).first()
    if not p:
        p = MembershipPlan(
            gym_id=gym_id,
            name=pd["name"],
            price=pd["price"],
            duration_days=pd["duration_days"],
            description=pd["description"],
            is_active=True
        )
        db.add(p)
        db.flush()
        print(f"Created plan: {p.name}")
    plan_map[p.name] = p

# 4. Add Categories if not exist
cat_names = [
    "Bebidas e Hidratación",
    "Suplementación Deportiva",
    "Snacks Saludables",
    "Accesorios y Ropa"
]
cat_map = {}
for cname in cat_names:
    c = db.query(Category).filter(Category.gym_id == gym_id, Category.name == cname).first()
    if not c:
        c = Category(gym_id=gym_id, name=cname, description=f"Productos de {cname}", is_active=True)
        db.add(c)
        db.flush()
        print(f"Created category: {c.name}")
    cat_map[cname] = c

# 5. Add Products if not exist
products_data = [
    ("Agua Cristal 600ml", "AGUA-600", "Bebidas e Hidratación", Decimal("1200"), Decimal("2500"), 50),
    ("Gatorade Blue 500ml", "GAT-BLUE", "Bebidas e Hidratación", Decimal("2800"), Decimal("4500"), 40),
    ("Red Bull Energy 250ml", "REDBULL-250", "Bebidas e Hidratación", Decimal("5200"), Decimal("8000"), 30),
    ("Proteína Whey Gold 2lb", "WHEY-GOLD-2LB", "Suplementación Deportiva", Decimal("140000"), Decimal("195000"), 15),
    ("Creatina Monohidrato 300g", "CREAT-300G", "Suplementación Deportiva", Decimal("65000"), Decimal("95000"), 20),
    ("Pre-Entreno C4 Extreme", "C4-PRE", "Suplementación Deportiva", Decimal("80000"), Decimal("115000"), 12),
    ("BCAA Recovery Amino", "BCAA-REC", "Suplementación Deportiva", Decimal("50000"), Decimal("75000"), 18),
    ("Barra Proteica Quest", "QUEST-BAR", "Snacks Saludables", Decimal("7500"), Decimal("12500"), 45),
    ("Galleta Proteica Lenny", "LENNY-COOKIE", "Snacks Saludables", Decimal("8500"), Decimal("14000"), 35),
    ("Shaker William Fit 700ml", "SHAKER-WF", "Accesorios y Ropa", Decimal("11000"), Decimal("22000"), 30),
    ("Toalla Microfibra Gym", "TOALLA-MF", "Accesorios y Ropa", Decimal("13000"), Decimal("25000"), 25),
    ("Straps de Halterofilia", "STRAPS-HAL", "Accesorios y Ropa", Decimal("10000"), Decimal("20000"), 20),
]

prod_map = {}
for pname, sku, cname, p_price, s_price, stock in products_data:
    p = db.query(Product).filter(Product.gym_id == gym_id, Product.sku == sku).first()
    if not p:
        p = Product(
            gym_id=gym_id,
            category_id=cat_map[cname].id,
            name=pname,
            sku=sku,
            purchase_price=p_price,
            sale_price=s_price,
            stock=stock,
            minimum_stock=5,
            is_active=True
        )
        db.add(p)
        db.flush()
        print(f"Created product: {p.name}")
    prod_map[sku] = p

db.commit()
print("Base catalog setup complete.")
