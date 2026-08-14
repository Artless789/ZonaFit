import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    
    query = text("""
        SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'invoices' OR tablename = 'invoice_details';
    """)
    result = db.execute(query).fetchall()
    
    print("POLICIES:")
    for row in result:
        print(row)
        
finally:
    db.close()
