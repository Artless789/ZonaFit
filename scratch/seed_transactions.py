import sys
sys.path.insert(0, r"C:\Dev\ZonaFit\backend")
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.database.database import SessionLocal
from app.models.user import User
from app.models.client import Client
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
gym_id = user.gym_id

clients = db.query(Client).filter(Client.gym_id == gym_id).order_by(Client.id).all()
plans = db.query(MembershipPlan).filter(MembershipPlan.gym_id == gym_id).all()
products = db.query(Product).filter(Product.gym_id == gym_id).all()

print(f"Gym {gym_id}: Found {len(clients)} clients, {len(plans)} plans, {len(products)} products.")

now = datetime.now(timezone.utc)
METHODS = ["CASH", "TRANSFER", "CARD"]

# We will assign memberships to ~105 clients
# 1. 8 clients expiring in 1 to 6 days
expiring_clients = clients[1:9]
for idx, c in enumerate(expiring_clients):
    p = random.choice([pl for pl in plans if pl.duration_days in [15, 30]])
    days_left = idx + 1 # 1 to 8 days
    start = now - timedelta(days=p.duration_days - days_left)
    end = start + timedelta(days=p.duration_days)
    mem = Membership(
        gym_id=gym_id,
        client_id=c.id,
        membership_plan_id=p.id,
        start_date=start,
        end_date=end,
        price=p.price,
        status="ACTIVE",
        is_active=True,
        created_at=start
    )
    db.add(mem)
    db.flush()
    # Add payment
    pay_date = start + timedelta(minutes=5)
    pay = Payment(
        gym_id=gym_id,
        membership_id=mem.id,
        amount=p.price,
        payment_method=random.choice(METHODS),
        status="PAID",
        is_active=True,
        reference=f"Pago membresía {p.name}",
        created_at=pay_date
    )
    db.add(pay)

print(f"Created {len(expiring_clients)} expiring memberships.")

# 2. 15 Expired memberships (ended in August or July)
expired_clients = clients[9:24]
for idx, c in enumerate(expired_clients):
    p = random.choice(plans)
    end_days_ago = random.randint(5, 45)
    end = now - timedelta(days=end_days_ago)
    start = end - timedelta(days=p.duration_days)
    mem = Membership(
        gym_id=gym_id,
        client_id=c.id,
        membership_plan_id=p.id,
        start_date=start,
        end_date=end,
        price=p.price,
        status="EXPIRED",
        is_active=True,
        created_at=start
    )
    db.add(mem)
    db.flush()
    pay = Payment(
        gym_id=gym_id,
        membership_id=mem.id,
        amount=p.price,
        payment_method=random.choice(METHODS),
        status="PAID",
        is_active=True,
        reference=f"Pago membresía {p.name}",
        created_at=start + timedelta(minutes=5)
    )
    db.add(pay)

print(f"Created {len(expired_clients)} expired memberships.")

# 3. 80 Active memberships (created in August or September)
# Make sure September has payments on multiple days (days 1, 2, 3, 4, 5)
active_clients = clients[24:105]
for idx, c in enumerate(active_clients):
    p = random.choice([pl for pl in plans if pl.duration_days >= 30])
    
    # 45 in September 2026, 35 in August/July 2026
    if idx < 45:
        # September 2026: days 1 to 5
        day_sept = (idx % 5) + 1 # days 1, 2, 3, 4, 5
        start = now.replace(day=day_sept, hour=random.randint(7, 20), minute=random.randint(0, 59))
        end = start + timedelta(days=p.duration_days)
    else:
        # August 2026
        day_aug = random.randint(1, 28)
        start = datetime(2026, 8, day_aug, random.randint(7, 20), random.randint(0, 59), tzinfo=timezone.utc)
        end = start + timedelta(days=p.duration_days)

    mem = Membership(
        gym_id=gym_id,
        client_id=c.id,
        membership_plan_id=p.id,
        start_date=start,
        end_date=end,
        price=p.price,
        status="ACTIVE",
        is_active=True,
        created_at=start
    )
    db.add(mem)
    db.flush()

    pay = Payment(
        gym_id=gym_id,
        membership_id=mem.id,
        amount=p.price,
        payment_method=random.choice(METHODS),
        status="PAID",
        is_active=True,
        reference=f"Pago membresía {p.name}",
        created_at=start + timedelta(minutes=2)
    )
    db.add(pay)

print(f"Created {len(active_clients)} active memberships.")

# 4. POS Sales of Products
# 30 Cash/Instant sales across September and August
pos_clients = clients[105:135]
for idx, c in enumerate(pos_clients):
    if idx < 15:
        day_sept = (idx % 5) + 1
        s_date = now.replace(day=day_sept, hour=random.randint(8, 21), minute=random.randint(0, 59))
    else:
        day_aug = random.randint(5, 27)
        s_date = datetime(2026, 8, day_aug, random.randint(8, 21), random.randint(0, 59), tzinfo=timezone.utc)

    # Pick 1 to 3 items
    selected_prods = random.sample(products, k=random.randint(1, 3))
    total_sale = Decimal("0.00")
    details = []
    
    for pr in selected_prods:
        qty = random.randint(1, 2)
        subt = pr.sale_price * qty
        total_sale += subt
        details.append((pr, qty, pr.sale_price, subt))

    sale = Sale(
        gym_id=gym_id,
        client_id=c.id if random.random() > 0.2 else None,
        total=total_sale,
        status=SaleStatus.COMPLETED,
        notes="Venta Mostrador Tienda POS",
        is_active=True,
        created_at=s_date
    )
    db.add(sale)
    db.flush()

    for pr, qty, unit_p, subt in details:
        sd = SaleDetail(
            sale_id=sale.id,
            product_id=pr.id,
            quantity=qty,
            unit_price=unit_p,
            subtotal=subt,
            created_at=s_date
        )
        db.add(sd)
        pr.stock = max(0, pr.stock - qty)

    pay = Payment(
        gym_id=gym_id,
        sale_id=sale.id,
        amount=total_sale,
        payment_method=random.choice(METHODS),
        status="PAID",
        is_active=True,
        reference="Cobro venta POS",
        created_at=s_date + timedelta(minutes=1)
    )
    db.add(pay)

print("Created 30 POS sales.")

# 5. Credit Sales & Accounts Receivable (Cartera Pendiente)
credit_clients = clients[135:140]
for idx, c in enumerate(credit_clients):
    pr = random.choice([p for p in products if p.sale_price >= 20000])
    qty = random.randint(1, 2)
    tot = pr.sale_price * qty
    
    s_date = now - timedelta(days=random.randint(5, 25))
    
    sale = Sale(
        gym_id=gym_id,
        client_id=c.id,
        total=tot,
        status=SaleStatus.COMPLETED,
        notes="Venta a Crédito",
        is_active=True,
        created_at=s_date
    )
    db.add(sale)
    db.flush()

    sd = SaleDetail(
        sale_id=sale.id,
        product_id=pr.id,
        quantity=qty,
        unit_price=pr.sale_price,
        subtotal=tot,
        created_at=s_date
    )
    db.add(sd)

    if idx in [0, 1]:
        # Overdue debt: due date in the past
        due = now - timedelta(days=random.randint(3, 12))
        ar = AccountsReceivable(
            gym_id=gym_id,
            client_id=c.id,
            sale_id=sale.id,
            original_amount=tot,
            paid_amount=Decimal("0.00"),
            balance_due=tot,
            due_date=due,
            status="PENDING",
            is_active=True,
            created_at=s_date
        )
        db.add(ar)
    elif idx in [2, 3]:
        # Partial payment made
        due = now + timedelta(days=random.randint(5, 15))
        abono = Decimal("15000.00")
        bal = tot - abono
        ar = AccountsReceivable(
            gym_id=gym_id,
            client_id=c.id,
            sale_id=sale.id,
            original_amount=tot,
            paid_amount=abono,
            balance_due=bal,
            due_date=due,
            status="PARTIAL",
            is_active=True,
            created_at=s_date
        )
        db.add(ar)
        db.flush()
        # Create Abono payment in September
        pay_date = now.replace(day=3, hour=11, minute=30)
        pay = Payment(
            gym_id=gym_id,
            accounts_receivable_id=ar.id,
            amount=abono,
            payment_method="TRANSFER",
            status="PAID",
            is_active=True,
            reference=f"Abono a cartera #{ar.id}",
            created_at=pay_date
        )
        db.add(pay)
    else:
        # Full pending, not overdue
        due = now + timedelta(days=12)
        ar = AccountsReceivable(
            gym_id=gym_id,
            client_id=c.id,
            sale_id=sale.id,
            original_amount=tot,
            paid_amount=Decimal("0.00"),
            balance_due=tot,
            due_date=due,
            status="PENDING",
            is_active=True,
            created_at=s_date
        )
        db.add(ar)

print(f"Created {len(credit_clients)} credit sales and accounts receivable.")

db.commit()
print("All transactions seeded successfully for william@gmail.com!")
