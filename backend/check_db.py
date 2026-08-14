import sys
import os
sys.path.append(os.getcwd())
from app.database.database import SessionLocal
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from sqlalchemy import text

db = SessionLocal()
db.info['bypass_rls'] = True
db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

payments = db.query(SubscriptionPayment).all()
print('PAYMENTS:')
for p in payments:
    print(f'ID: {p.id}, Gym: {p.gym_id}, Sub: {p.subscription_id}, Status: {p.status.value}, Wompi: {p.provider_transaction_id}')

subs = db.query(Subscription).all()
print('\nSUBSCRIPTIONS:')
for s in subs:
    print(f'ID: {s.id}, Gym: {s.gym_id}, Status: {s.status}, Plan: {s.plan_id}, Ends: {s.ends_at}')
