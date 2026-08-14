import re

file_path = "C:/Dev/ZonaFit/backend/app/routers/subscriptions.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure we import SubscriptionStartRequest
content = content.replace(
    "from app.schemas.subscription import SubscriptionResponse, SubscriptionPaymentInitResponse, SubscriptionPaymentInitRequest, SubscriptionVerifyRequest",
    "from app.schemas.subscription import SubscriptionResponse, SubscriptionPaymentInitResponse, SubscriptionPaymentInitRequest, SubscriptionVerifyRequest, SubscriptionStartRequest"
)

new_endpoint = """
@router.post("/start", response_model=SubscriptionResponse)
def start_subscription(
    payload: SubscriptionStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")

    # Check if a subscription already exists
    existing = SubscriptionService.get_current_subscription(db, current_user.gym_id)
    if existing:
        return existing

    now = datetime.utcnow()
    
    if payload.intent == 'TRIAL':
        ends_at = now + timedelta(days=14)
        audit_action = "TRIAL_STARTED"
    elif payload.intent == 'PURCHASE':
        ends_at = now # Expira de inmediato, forzando el pago
        audit_action = "PURCHASE_INTENT_STARTED"
    else:
        raise HTTPException(status_code=400, detail="Invalid intent")

    new_sub = Subscription(
        gym_id=current_user.gym_id,
        plan_id=None,
        status="TRIAL",
        starts_at=now,
        ends_at=ends_at,
        is_lifetime=False
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)

    audit = AuditLog(
        gym_id=current_user.gym_id,
        user_id=current_user.id,
        action=audit_action,
        entity_type="SUBSCRIPTION",
        new_values={"details": f"Started with intent: {payload.intent}"}
    )
    db.add(audit)
    db.commit()

    return new_sub
"""

# Append the endpoint right before `init_payment`
content = content.replace("@router.post(\"/{sub_id}/payment\",", new_endpoint + "\n@router.post(\"/{sub_id}/payment\",")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
