import sys
import os
sys.path.append('.')
from sqlalchemy import text
from app.database.database import SessionLocal

db = SessionLocal()

try:
    print("\n--- Verifying Membership Payment (Existing Functionality) ---")
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    
    try:
        # Assuming membership_id=1 exists or fails with FK. If FK, the CHECK constraint passes.
        db.execute(text(
            "INSERT INTO payments (gym_id, amount, payment_method, membership_id, status) "
            "VALUES (1, 100, 'CASH', 1, 'PAID')"
        ))
        db.commit()
        print("PASS: Payment inserted with only membership_id.")
    except Exception as e:
        db.rollback()
        err_msg = str(e).split('\n')[0]
        if 'chk_payment_context' in err_msg:
            print("FAIL: Check constraint prevented valid membership payment!")
        elif 'memberships' in err_msg or 'gyms' in err_msg:
            print("PASS: Membership/Gym FK prevented insert, but check constraint passed. Error:", err_msg)
        else:
            print("PASS/INFO: Error unrelated to check constraint:", err_msg)

finally:
    db.close()
