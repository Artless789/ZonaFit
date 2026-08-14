from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.auth import get_current_user, require_owner
from app.database.database import get_db
from app.models.user import User
from app.models.subscription import Subscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.plan import Plan
from app.models.audit_log import AuditLog
from app.schemas.subscription import SubscriptionResponse, SubscriptionPaymentInitResponse, SubscriptionPaymentInitRequest, SubscriptionVerifyRequest, SubscriptionStartRequest
from app.schemas.plan import PlanResponse
from app.services.subscription_service import SubscriptionService
from app.models.subscription_payment import TransactionStatus
from app.core.config import settings
from datetime import datetime, timedelta, timezone
from fastapi import Request, BackgroundTasks
import hashlib
import uuid

router = APIRouter(
    prefix="/subscription",
    tags=["Subscription"]
)

@router.get("/plans", response_model=list[PlanResponse])
def get_available_plans(
    db: Session = Depends(get_db)
):
    # This endpoint is public so the Landing Page can show commercial plans.
    plans = db.query(Plan).filter(Plan.is_active == True).all()
    return plans

@router.get("/me", response_model=SubscriptionResponse)
def get_my_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")
        
    sub = SubscriptionService.get_current_subscription(db, current_user.gym_id)
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found for your gym")
        
    return sub


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

@router.post("/{sub_id}/payment", response_model=SubscriptionPaymentInitResponse)
def init_payment(
    sub_id: int,
    payload: SubscriptionPaymentInitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_owner(current_user)
    if not current_user.gym_id:
        raise HTTPException(status_code=400, detail="User is not associated with a gym")
        
    sub = db.query(Subscription).filter(Subscription.id == sub_id, Subscription.gym_id == current_user.gym_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    plan = db.query(Plan).filter(Plan.id == payload.plan_id).first()
    if not plan or not plan.is_active:
        raise HTTPException(status_code=400, detail="Plan is not valid for payment")

    # Update subscription with the selected plan before initiating payment
    sub.plan_id = plan.id
    db.commit()
    db.refresh(sub)
        
    # Real amount in cents calculation based on the backend Plan, NEVER frontend
    amount_in_cents = int(plan.price * 100)
    currency = plan.currency
    
    unique_ref = f"ZF-SUB-{sub.id}-{uuid.uuid4().hex[:8].upper()}"
    
    # Save the pending payment transaction for audit and webhook verification
    payment = SubscriptionPayment(
        gym_id=current_user.gym_id,
        subscription_id=sub.id,
        reference=unique_ref,
        amount_in_cents=amount_in_cents,
        currency=currency,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    # Generate integrity signature for Wompi Widget
    # Signature formula: SHA256(reference + amountInCents + currency + integritySecret)
    signature_string = f"{unique_ref}{amount_in_cents}{currency}{settings.WOMPI_INTEGRITY_SECRET}"
    signature = hashlib.sha256(signature_string.encode('utf-8')).hexdigest()
    
    audit = AuditLog(
        gym_id=current_user.gym_id,
        user_id=current_user.id,
        action="PAYMENT_CREATED",
        entity_type="SUBSCRIPTION_PAYMENT",
    )
    db.add(audit)
    db.commit()
    
    return SubscriptionPaymentInitResponse(
        reference=unique_ref,
        amount_in_cents=amount_in_cents,
        currency=currency,
        signature=signature,
        public_key=settings.WOMPI_PUBLIC_KEY
    )

def _get_nested_value(obj: dict, path: str):
    keys = path.split('.')
    val = obj
    for k in keys:
        if isinstance(val, dict) and k in val:
            val = val[k]
        else:
            return None
    return val

@router.post("/webhook/wompi")
async def wompi_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = payload.get("event")
    data = payload.get("data", {})
    signature_data = payload.get("signature", {})
    timestamp = payload.get("timestamp")

    if not signature_data:
        return {"status": "ignored", "reason": "No signature provided"}

    # 1. Validation
    properties = signature_data.get("properties", [])
    received_checksum = signature_data.get("checksum", "")

    concatenated = ""
    for prop in properties:
        val = _get_nested_value(data, prop)
        # Convert to string and handle nulls correctly (Wompi uses empty string or 'null' depending on implementation, 
        # usually just str() or nothing if None). Let's convert properly. Wompi appends exactly the value as string.
        if val is None:
            concatenated += ""
        else:
            concatenated += str(val)

    concatenated += str(timestamp)
    concatenated += settings.WOMPI_EVENTS_SECRET

    expected_checksum = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()

    if expected_checksum != received_checksum:
        # We must log this in audit and return 400 or just 200 to prevent retry attacks, but Wompi expects 200.
        return {"status": "ignored", "reason": "Invalid signature"}

    # Event signature is valid!
    from sqlalchemy import text
    # Bypass RLS for the webhook since it's global and cryptographic signature is already verified
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    if event == "transaction.updated":
        transaction = data.get("transaction", {})
        reference = transaction.get("reference")
        wompi_status = transaction.get("status")
        provider_id = transaction.get("id")
        amount = transaction.get("amount_in_cents")
        currency = transaction.get("currency")
        
        # Find the payment in our system and lock the row to serialize concurrent webhooks
        payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.reference == reference).with_for_update().populate_existing().first()
        if not payment:
            return {"status": "ignored", "reason": "Payment reference not found"}
            
        # Ensure we have the absolute latest state from the DB after acquiring the lock
        db.refresh(payment)
            
        # Cross-validation
        if payment.amount_in_cents != amount or payment.currency != currency:
            # Audit log the discrepancy
            audit = AuditLog(
                gym_id=payment.gym_id,
                action="PAYMENT_ERROR",
                entity_type="SUBSCRIPTION_PAYMENT",
                new_values={"details": f"Amount or currency mismatch. Expected {payment.amount_in_cents} {payment.currency}, got {amount} {currency}"}
            )
            db.add(audit)
            db.commit()
            return {"status": "error", "reason": "Data mismatch"}
            
        with open("webhook_debug.txt", "a") as f:
            f.write(f"WEBHOOK DEBUG: payment read after lock. ID={payment.id}, STATUS={payment.status.value}, PROVIDER_ID={payment.provider_transaction_id}\n")
        # Idempotency check 1: Duplicate webhook (Already processed with same provider ID and status)
        if payment.provider_transaction_id == provider_id and payment.status.value == wompi_status:
            with open("webhook_debug.txt", "a") as f:
                f.write("WEBHOOK DEBUG: Caught duplicate webhook!\n")
            db.rollback()
            return {"status": "ok", "reason": "Already processed"}
            
        # Idempotency check 2: Prevent state regression
        if payment.status.value in ("APPROVED", "DECLINED", "ERROR", "VOIDED"):
            # If the payment reached a final state but the webhook is trying to change it
            with open("webhook_debug.txt", "a") as f:
                f.write(f"WEBHOOK DEBUG: Caught state regression. Current: {payment.status.value}, Trying: {wompi_status}\n")
            db.rollback()
            return {"status": "ignored", "reason": f"Payment already in final state: {payment.status.value}"}
            
        with open("webhook_debug.txt", "a") as f:
            f.write("WEBHOOK DEBUG: Proceeding to process and commit.\n")
            
        # Update payment
        payment.provider_transaction_id = provider_id
        payment.status = wompi_status
        payment.updated_at = datetime.utcnow()
        
        # Audit log the transition
        audit = AuditLog(
            gym_id=payment.gym_id,
            action=f"PAYMENT_{wompi_status}",
            entity_type="SUBSCRIPTION_PAYMENT",
            new_values={"details": f"Wompi ID: {provider_id}"}
        )
        db.add(audit)
        
        # If APPROVED, activate the subscription
        if wompi_status == "APPROVED":
            sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
            plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
            
            if sub and plan:
                sub.status = "ACTIVE"
                # Update ends_at based on plan billing_interval
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                if not sub.starts_at or not sub.ends_at or sub.ends_at < now:
                    sub.starts_at = now
                    # Add from now
                    if plan.billing_interval == "MONTHLY":
                        sub.ends_at = now + timedelta(days=30)
                    elif plan.billing_interval == "YEARLY":
                        sub.ends_at = now + timedelta(days=365)
                else:
                    # Extend from current ends_at
                    if plan.billing_interval == "MONTHLY":
                        sub.ends_at = sub.ends_at + timedelta(days=30)
                    elif plan.billing_interval == "YEARLY":
                        sub.ends_at = sub.ends_at + timedelta(days=365)
                    
                audit_sub = AuditLog(
                    gym_id=payment.gym_id,
                    action="SUBSCRIPTION_ACTIVATED",
                    entity_type="SUBSCRIPTION",
                    new_values={"details": f"Subscription {sub.id} activated via payment {payment.id}"}
                )
                db.add(audit_sub)

        db.commit()
        return {"status": "ok"}
        
    return {"status": "ignored", "reason": "Unhandled event type"}



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

