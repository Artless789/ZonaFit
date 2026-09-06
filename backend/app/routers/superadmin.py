from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.auth import get_current_user, require_superadmin
from app.database.database import get_db
from app.models.gym import Gym
from app.models.user import User
from app.models.client import Client
from app.models.audit_log import AuditLog
from app.models.plan import Plan
from app.models.subscription import Subscription, SubscriptionStatus
from app.schemas.pagination import PaginationResponse, calculate_total_pages
from app.schemas.plan import PlanResponse, PlanCreate, PlanUpdate
from app.schemas.subscription import SubscriptionResponse, SubscriptionCreate
from app.services.subscription_service import SubscriptionService
from app.models.subscription_payment import SubscriptionPayment, TransactionStatus
from app.core.config import settings
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

from app.schemas.superadmin import (
    SuperadminGymResponse,
    SuperadminGymDetailResponse,
    GymDetailUser,
    SuperadminPaymentItem,
    SuperadminRefundRequest,
    SuperadminRefundResponse,
    SuperadminUserResponse,
    SuperadminAuditResponse,
    SuperadminDashboardMetrics
)

router = APIRouter(
    prefix="/superadmin",
    tags=["Superadmin"],
    dependencies=[Depends(require_superadmin)]
)

@router.get("/dashboard", response_model=SuperadminDashboardMetrics)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    total_gyms = db.query(Gym).count()
    active_gyms = db.query(Gym).filter(Gym.is_active == True).count()
    inactive_gyms = db.query(Gym).filter(Gym.is_active == False).count()
    pending_onboarding_gyms = db.query(Gym).filter(Gym.onboarding_completed == False).count()
    total_users = db.query(User).count()
    total_superadmins = db.query(User).filter(User.role == "SUPERADMIN").count()
    
    active_subscriptions = db.query(Subscription).filter(Subscription.status == SubscriptionStatus.ACTIVE).count()
    trial_subscriptions = db.query(Subscription).filter(Subscription.status == SubscriptionStatus.TRIAL).count()
    expired_subscriptions = db.query(Subscription).filter(Subscription.status == SubscriptionStatus.EXPIRED).count()
    
    active_plans = db.query(Plan).filter(Plan.is_active == True).count()
    
    revenue_cents = db.query(func.sum(SubscriptionPayment.amount_in_cents)).filter(
        SubscriptionPayment.status == TransactionStatus.APPROVED
    ).scalar() or 0
    total_revenue = revenue_cents / 100.0
    
    return SuperadminDashboardMetrics(
        total_gyms=total_gyms,
        active_gyms=active_gyms,
        inactive_gyms=inactive_gyms,
        pending_onboarding_gyms=pending_onboarding_gyms,
        total_users=total_users,
        total_superadmins=total_superadmins,
        active_subscriptions=active_subscriptions,
        trial_subscriptions=trial_subscriptions,
        expired_subscriptions=expired_subscriptions,
        active_plans=active_plans,
        total_revenue=total_revenue
    )

@router.get("/gyms", response_model=PaginationResponse[SuperadminGymResponse])
def get_gyms(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = Query(None, description="Buscar por nombre, correo de gimnasio o propietario"),
    db: Session = Depends(get_db)
):
    query = db.query(Gym)
    if search and search.strip():
        term = f"%{search.strip()}%"
        owner_subquery = db.query(User.gym_id).filter(
            User.role == "OWNER",
            or_(User.full_name.ilike(term), User.email.ilike(term))
        ).subquery()
        query = query.filter(
            or_(
                Gym.name.ilike(term),
                Gym.email.ilike(term),
                Gym.phone.ilike(term),
                Gym.id.in_(db.query(owner_subquery.c.gym_id))
            )
        )
    
    query = query.order_by(Gym.id.desc())
    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    # Enrich with related info safely
    results = []
    for gym in items:
        owner = db.query(User).filter(User.gym_id == gym.id, User.role == "OWNER").first()
        sub = db.query(Subscription).filter(Subscription.gym_id == gym.id).order_by(Subscription.id.desc()).first()
        plan_name = None
        if sub and sub.plan_id:
            plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
            if plan:
                plan_name = plan.name

        sub_status = None
        if sub and sub.status is not None:
            sub_status = sub.status.value if hasattr(sub.status, "value") else str(sub.status)

        results.append(SuperadminGymResponse(
            id=gym.id,
            name=gym.name,
            email=gym.email,
            phone=gym.phone,
            address=gym.address,
            is_active=gym.is_active,
            onboarding_completed=gym.onboarding_completed,
            owner_name=owner.full_name if owner else None,
            owner_email=owner.email if owner else None,
            current_plan_name=plan_name,
            subscription_status=sub_status,
            subscription_starts_at=sub.starts_at if sub else None,
            subscription_ends_at=sub.ends_at if sub else None,
            created_at=None
        ))
    
    return PaginationResponse(
        items=results,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/gyms/{gym_id}", response_model=SuperadminGymDetailResponse)
def get_gym_detail(
    gym_id: int,
    db: Session = Depends(get_db)
):
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gimnasio no encontrado")
        
    owner = db.query(User).filter(User.gym_id == gym.id, User.role == "OWNER").first()
    sub = db.query(Subscription).filter(Subscription.gym_id == gym.id).order_by(Subscription.id.desc()).first()
    
    plan_name = None
    plan_id = None
    if sub and sub.plan_id:
        plan = db.query(Plan).filter(Plan.id == sub.plan_id).first()
        if plan:
            plan_name = plan.name
            plan_id = plan.id
            
    sub_status = None
    if sub and sub.status is not None:
        sub_status = sub.status.value if hasattr(sub.status, "value") else str(sub.status)
        
    users = db.query(User).filter(User.gym_id == gym.id).order_by(User.id.asc()).all()
    total_clients = db.query(Client).filter(Client.gym_id == gym.id).count()
    payments = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.gym_id == gym.id
    ).order_by(SubscriptionPayment.created_at.desc()).all()
    
    return SuperadminGymDetailResponse(
        id=gym.id,
        name=gym.name,
        email=gym.email,
        phone=gym.phone,
        address=gym.address,
        is_active=gym.is_active,
        onboarding_completed=gym.onboarding_completed,
        owner_id=owner.id if owner else None,
        owner_name=owner.full_name if owner else None,
        owner_email=owner.email if owner else None,
        subscription_id=sub.id if sub else None,
        current_plan_id=plan_id,
        current_plan_name=plan_name,
        subscription_status=sub_status,
        subscription_starts_at=sub.starts_at if sub else None,
        subscription_ends_at=sub.ends_at if sub else None,
        is_lifetime=sub.is_lifetime if sub else False,
        total_users=len(users),
        total_clients=total_clients,
        users=[
            GymDetailUser(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=u.role,
                is_active=u.is_active
            ) for u in users
        ],
        payments=[
            SuperadminPaymentItem(
                id=p.id,
                reference=p.reference,
                amount_in_cents=p.amount_in_cents,
                currency=p.currency,
                status=p.status.value if hasattr(p.status, "value") else str(p.status),
                provider_transaction_id=p.provider_transaction_id,
                refund_reason=p.refund_reason,
                refunded_at=p.refunded_at,
                created_at=p.created_at
            ) for p in payments
        ]
    )

@router.get("/users", response_model=PaginationResponse[SuperadminUserResponse])
def get_users(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(User).order_by(User.id.desc())
    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return PaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/audit", response_model=PaginationResponse[SuperadminAuditResponse])
def get_audit(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).order_by(AuditLog.id.desc())
    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return PaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/plans", response_model=PaginationResponse[PlanResponse])
def get_plans(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(Plan).order_by(Plan.id.desc())
    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return PaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/plans", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    plan_data: PlanCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Plan).filter(Plan.slug == plan_data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Plan with this slug already exists.")
        
    new_plan = Plan(**plan_data.model_dump())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

@router.put("/plans/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: int,
    plan_data: PlanUpdate,
    db: Session = Depends(get_db)
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    update_data = plan_data.model_dump(exclude_unset=True)
    if "slug" in update_data:
        existing = db.query(Plan).filter(Plan.slug == update_data["slug"], Plan.id != plan_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Another plan with this slug exists.")
            
    for key, value in update_data.items():
        setattr(plan, key, value)
        
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/subscriptions", response_model=PaginationResponse[SubscriptionResponse])
def get_subscriptions(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    query = db.query(Subscription).order_by(Subscription.id.desc())
    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()
    
    return PaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/gyms/{gym_id}/subscription", response_model=SubscriptionResponse)
def get_gym_subscription(
    gym_id: int,
    db: Session = Depends(get_db)
):
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    sub = SubscriptionService.get_current_subscription(db, gym_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    return sub

@router.post("/gyms/{gym_id}/subscription", response_model=SubscriptionResponse)
def assign_gym_subscription(
    gym_id: int,
    sub_data: SubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gym not found")
        
    if sub_data.plan_id is not None:
        plan = db.query(Plan).filter(Plan.id == sub_data.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
            
        if not plan.is_active:
            raise HTTPException(status_code=400, detail="Cannot assign inactive plan")
        
    active_subs = db.query(Subscription).filter(
        Subscription.gym_id == gym_id,
        Subscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL])
    ).all()
    
    for old_sub in active_subs:
        old_sub.status = SubscriptionStatus.CANCELLED
        
    new_sub = Subscription(
        gym_id=gym_id,
        **sub_data.model_dump()
    )
    db.add(new_sub)
    
    audit = AuditLog(
        gym_id=gym_id,
        user_id=current_user.id,
        action="SUBSCRIPTION_CREATED",
        entity_type="SUBSCRIPTION",
    )
    db.add(audit)
    
    db.commit()
    db.refresh(new_sub)
    return new_sub

@router.post("/gyms/{gym_id}/subscription/payments/{payment_id}/refund", response_model=SuperadminRefundResponse)
def refund_subscription_payment(
    gym_id: int,
    payment_id: int,
    payload: SuperadminRefundRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    gym = db.query(Gym).filter(Gym.id == gym_id).first()
    if not gym:
        raise HTTPException(status_code=404, detail="Gimnasio no encontrado")
        
    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.id == payment_id,
        SubscriptionPayment.gym_id == gym_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago de suscripción no encontrado")
        
    if payment.status != TransactionStatus.APPROVED:
        raise HTTPException(
            status_code=400, 
            detail=f"Solo se pueden reembolsar transacciones en estado APPROVED. Estado actual: {payment.status.value}"
        )
        
    # Attempt Wompi void/refund API if provider transaction ID exists
    wompi_res = None
    if payment.provider_transaction_id:
        try:
            import httpx
            wompi_url = f"{settings.WOMPI_API_URL}/transactions/{payment.provider_transaction_id}/void"
            headers = {"Authorization": f"Bearer {settings.WOMPI_PRIVATE_KEY}"}
            with httpx.Client(timeout=10) as client:
                resp = client.post(wompi_url, headers=headers)
                if resp.status_code in (200, 201):
                    wompi_res = resp.json()
                else:
                    logger.warning(f"Wompi void returned {resp.status_code}: {resp.text}")
                    wompi_res = {"status_code": resp.status_code, "detail": resp.text}
        except Exception as e:
            logger.error(f"Error calling Wompi void API: {e}")
            wompi_res = {"error": str(e)}

    # Mark payment as VOIDED (refunded) with timestamp and reason
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    payment.status = TransactionStatus.VOIDED
    payment.refund_reason = payload.reason
    payment.refunded_at = now
    payment.updated_at = now
    
    # Audit log
    audit = AuditLog(
        gym_id=gym_id,
        user_id=current_user.id,
        action="SUBSCRIPTION_REFUNDED",
        entity_type="SUBSCRIPTION_PAYMENT",
        entity_id=payment.id,
        new_values={
            "details": f"Refunded payment #{payment.id}. Reason: {payload.reason}. Revoked access: {payload.revoke_access_immediately}"
        }
    )
    db.add(audit)
    
    # If immediate revocation was requested, terminate subscription
    if payload.revoke_access_immediately:
        sub = db.query(Subscription).filter(Subscription.id == payment.subscription_id).first()
        if sub:
            sub.status = SubscriptionStatus.CANCELLED
            sub.ends_at = now
            sub.updated_at = now
            audit_sub = AuditLog(
                gym_id=gym_id,
                user_id=current_user.id,
                action="SUBSCRIPTION_REVOKED",
                entity_type="SUBSCRIPTION",
                entity_id=sub.id,
                new_values={"details": "Access revoked due to payment refund"}
            )
            db.add(audit_sub)
            
    db.commit()
    db.refresh(payment)
    
    return SuperadminRefundResponse(
        success=True,
        message=f"Pago #{payment.id} reembolsado/anulado exitosamente.",
        status=payment.status.value,
        wompi_response=wompi_res
    )

