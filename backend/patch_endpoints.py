import re

file_path = "C:/Dev/ZonaFit/backend/app/routers/subscriptions.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

new_endpoints = """

@router.get("/history")
def get_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")
        
    payments = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.gym_id == current_user.gym_id
    ).order_by(SubscriptionPayment.created_at.desc()).all()
    
    # Simple dict mapping for now
    return [
        {
            "id": p.id,
            "reference": p.reference,
            "amount_in_cents": p.amount_in_cents,
            "currency": p.currency,
            "status": p.status.value,
            "created_at": p.created_at,
            "provider_transaction_id": p.provider_transaction_id
        }
        for p in payments
    ]

@router.post("/cancel")
def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")
        
    sub = SubscriptionService.get_current_subscription(db, current_user.gym_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
        
    # Mark cancellation request
    now = datetime.utcnow()
    sub.cancellation_requested_at = now
    
    # Record audit
    audit = AuditLog(
        gym_id=current_user.gym_id,
        user_id=current_user.id,
        action="SUBSCRIPTION_CANCELLED",
        entity_type="SUBSCRIPTION",
        new_values={"details": "User requested cancellation"}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Subscription cancellation requested successfully."}

@router.post("/reactivate")
def reactivate_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")
        
    sub = SubscriptionService.get_current_subscription(db, current_user.gym_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription found")
        
    # Remove cancellation request
    sub.cancellation_requested_at = None
    
    # Record audit
    audit = AuditLog(
        gym_id=current_user.gym_id,
        user_id=current_user.id,
        action="SUBSCRIPTION_REACTIVATED",
        entity_type="SUBSCRIPTION",
        new_values={"details": "User revoked cancellation request"}
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Subscription reactivated successfully."}

"""

# Append at the bottom of the file
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content + new_endpoints)
