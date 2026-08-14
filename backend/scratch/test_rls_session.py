import sys
sys.path.append('C:\\Dev\\ZonaFit\\backend')
from sqlalchemy import text, event
from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.client import Client

@event.listens_for(Session, "after_begin")
def set_rls_on_begin(session, transaction, connection):
    tenant_id = session.info.get('tenant_id')
    bypass = session.info.get('bypass_rls')
    
    if bypass:
        connection.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    elif tenant_id:
        connection.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(tenant_id)})

def test_rls():
    db = SessionLocal()
    try:
        # Simulate get_current_user setting the info
        db.info['tenant_id'] = 13
        
        # Manually begin a transaction if it hasn't
        # Actually SQLAlchemy begins automatically on first query
        val = db.execute(text("SELECT current_setting('app.current_gym_id', true)")).scalar()
        print(f"First transaction tenant_id: {val}")
        
        # Simulate creating a client
        new_client = Client(
            gym_id=13,
            full_name="Test Session RLS",
            document_type="CC",
            document="999999999",
            phone="123",
            email="test@sessionrls.com",
            is_active=True
        )
        db.add(new_client)
        db.commit() # This closes the transaction!
        print("Transaction committed.")
        
        # Now refresh. This triggers a new transaction.
        # The after_begin event should fire again and inject the context!
        db.refresh(new_client)
        print(f"Refresh succeeded! Client ID: {new_client.id}")
        
        # Cleanup
        db.delete(new_client)
        db.commit()
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_rls()
