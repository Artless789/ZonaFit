import re

file_path = "C:/Dev/ZonaFit/backend/app/routers/subscriptions.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure we import SubscriptionVerifyRequest
content = content.replace(
    "from app.schemas.subscription import SubscriptionResponse, SubscriptionPaymentInitResponse, SubscriptionPaymentInitRequest",
    "from app.schemas.subscription import SubscriptionResponse, SubscriptionPaymentInitResponse, SubscriptionPaymentInitRequest, SubscriptionVerifyRequest"
)

new_endpoint = """

@router.post("/{sub_id}/payment/verify")
def verify_payment(
    sub_id: int,
    payload: SubscriptionVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")

    # Fetch transaction from Wompi API
    wompi_url = f"{settings.WOMPI_API_URL}/transactions/{payload.transaction_id}"
    import httpx
    try:
        response = httpx.get(wompi_url)
        response.raise_for_status()
        data = response.json().get("data", {})
    except Exception as e:
        raise HTTPException(status_code=400, detail="Failed to verify transaction with Wompi")

    reference = data.get("reference")
    wompi_status = data.get("status")
    provider_id = data.get("id")
    amount = data.get("amount_in_cents")
    currency = data.get("currency")

    # Check that the payment belongs to this gym and subscription
    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.reference == reference,
        SubscriptionPayment.gym_id == current_user.gym_id,
        SubscriptionPayment.subscription_id == sub_id
    ).with_for_update().populate_existing().first()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment reference not found for this gym")
        
    if payment.amount_in_cents != amount or payment.currency != currency:
        db.rollback()
        raise HTTPException(status_code=400, detail="Data mismatch")
        
    if payment.provider_transaction_id == provider_id and payment.status.value == wompi_status:
        db.rollback()
        return {"status": payment.status.value}
        
    if payment.status.value in ("APPROVED", "DECLINED", "ERROR", "VOIDED"):
        db.rollback()
        return {"status": payment.status.value}
        
    payment.provider_transaction_id = provider_id
    payment.status = wompi_status
    payment.updated_at = datetime.utcnow()
    
    audit = AuditLog(
        gym_id=payment.gym_id,
        action=f"PAYMENT_{wompi_status}_VERIFIED",
        entity_type="SUBSCRIPTION_PAYMENT",
        new_values={"details": f"Wompi ID: {provider_id} verified via frontend callback"}
    )
    db.add(audit)
    
    if wompi_status == "APPROVED":
        sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
        
        if sub and plan:
            sub.status = "ACTIVE"
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if not sub.starts_at or not sub.ends_at or sub.ends_at < now:
                sub.starts_at = now
                if plan.billing_interval == "MONTHLY":
                    sub.ends_at = now + timedelta(days=30)
                elif plan.billing_interval == "YEARLY":
                    sub.ends_at = now + timedelta(days=365)
            else:
                if plan.billing_interval == "MONTHLY":
                    sub.ends_at = sub.ends_at + timedelta(days=30)
                elif plan.billing_interval == "YEARLY":
                    sub.ends_at = sub.ends_at + timedelta(days=365)
                
            audit_sub = AuditLog(
                gym_id=payment.gym_id,
                action="SUBSCRIPTION_ACTIVATED_VERIFIED",
                entity_type="SUBSCRIPTION",
                new_values={"details": f"Subscription {sub.id} activated via payment {payment.id} verified from frontend"}
            )
            db.add(audit_sub)

    db.commit()
    return {"status": payment.status.value}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content + new_endpoint)
