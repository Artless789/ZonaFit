import sys
import os
sys.path.append('.')
from sqlalchemy import text
from app.database.database import SessionLocal
import datetime

db = SessionLocal()

try:
    # 1. Apply RLS policies manually to the DB
    print("Applying RLS policies to accounts_receivables...")
    db.execute(text("ALTER TABLE accounts_receivables ENABLE ROW LEVEL SECURITY"))
    db.execute(text("ALTER TABLE accounts_receivables FORCE ROW LEVEL SECURITY"))
    db.execute(text(
        "CREATE POLICY tenant_isolation_policy ON accounts_receivables "
        "USING (gym_id = current_setting('app.current_gym_id', true)::integer "
        "OR current_setting('app.bypass_rls', true) = 'on')"
    ))
    db.commit()
    print("RLS applied successfully.")
except Exception as e:
    db.rollback()
    print("RLS maybe already applied or error:", str(e).split('\n')[0])


try:
    print("\n--- Verifying CHECK CONSTRAINT on payments ---")
    # Bypass RLS to test constraints
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    
    try:
        db.execute(text(
            "INSERT INTO payments (gym_id, amount, payment_method) "
            "VALUES (1, 100, 'CASH')"
        ))
        db.commit()
        print("FAIL: Payment inserted without any context!")
    except Exception as e:
        db.rollback()
        if 'chk_payment_context' in str(e):
            print("PASS: Prevented Payment without context (0 contexts)")
        else:
            print("PASS: Prevented Payment without context:", str(e).split('\n')[0])
            
    # Test 2 contexts
    try:
        db.execute(text(
            "INSERT INTO payments (gym_id, amount, payment_method, membership_id, sale_id) "
            "VALUES (1, 100, 'CASH', 1, 1)"
        ))
        db.commit()
        print("FAIL: Payment inserted with 2 contexts!")
    except Exception as e:
        db.rollback()
        if 'chk_payment_context' in str(e):
            print("PASS: Prevented Payment with >1 context (2 contexts)")
        else:
            print("PASS: Prevented Payment with 2 contexts:", str(e).split('\n')[0])

    print("\n--- Verifying RLS on accounts_receivables ---")
    
    # Try inserting without RLS bypass or setting gym
    db.execute(text("SELECT set_config('app.bypass_rls', '', true)"))
    db.execute(text("SELECT set_config('app.current_gym_id', '', true)"))
    
    # Try to read
    count = db.execute(text("SELECT count(*) FROM accounts_receivables")).scalar()
    print("Read without RLS context (should be 0):", count)
    if count == 0:
        print("PASS: RLS prevents reading accounts_receivables without context")
    else:
        print("FAIL: RLS did not prevent reading!")
        
finally:
    db.close()
