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

res = db.execute(text("SELECT payment_method, count(1) FROM payments GROUP BY payment_method")).fetchall()
print('PAYMENTS BY METHOD:', res)




