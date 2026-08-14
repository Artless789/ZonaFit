from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
import os
import uuid
import shutil
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    Client360Response,
    ClientMembershipSummary,
    ClientFinancialSummary
)
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
from app.constants.membership_status import MembershipStatus
from decimal import Decimal
from datetime import datetime, timezone

router = APIRouter(
    prefix="/clients",
    tags=["Clients"],
)


# ==========================
# Crear cliente
# ==========================

@router.post(
    "/",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_client(
    client: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_client = (
        db.query(Client)
        .filter(
            Client.gym_id == current_user.gym_id,
            Client.document == client.document,
        )
        .first()
    )

    if existing_client:
        raise HTTPException(
            status_code=400,
            detail="Client already exists.",
        )

    new_client = Client(
        gym_id=current_user.gym_id,
        full_name=client.full_name,
        document_type=client.document_type,
        document=client.document,
        phone=client.phone,
        email=client.email,
        notes=client.notes,
    )

    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    return new_client


from sqlalchemy import or_
from app.schemas.pagination import PaginationResponse, calculate_total_pages

# ==========================
# Listar clientes
# ==========================

@router.get(
    "/",
    response_model=PaginationResponse[ClientResponse],
)
def get_clients(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if page < 1:
        raise HTTPException(status_code=422, detail="Page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=422, detail="Page size must be between 1 and 100")

    query = db.query(Client).filter(Client.gym_id == current_user.gym_id)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Client.full_name.ilike(search_term),
                Client.document.ilike(search_term),
                Client.email.ilike(search_term),
            )
        )

    if is_active is not None:
        query = query.filter(Client.is_active == is_active)

    # Order by newest first
    query = query.order_by(Client.created_at.desc())

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


# ==========================
# Obtener foto de cliente
# ==========================

@router.get("/photo/{filename}")
def get_client_photo(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # RLS: the photo_url format is /clients/photo/{filename}
    # We must ensure the client with this photo_url belongs to the current user's gym
    client = (
        db.query(Client)
        .filter(
            Client.gym_id == current_user.gym_id,
            Client.photo_url == f"/clients/photo/{filename}",
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Photo not found or unauthorized.")

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(file_path)


# ==========================
# Obtener cliente por ID
# ==========================

@router.get(
    "/{client_id}",
    response_model=ClientResponse,
)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.gym_id == current_user.gym_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    return client

# ==========================
# Obtener cliente 360
# ==========================

@router.get(
    "/{client_id}/360",
    response_model=Client360Response,
)
def get_client_360(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.gym_id == current_user.gym_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    now = datetime.now(timezone.utc)

    # 1. Membership summary
    # Get the latest membership (could be active or expired, but we prioritize ACTIVE or the one with latest end_date)
    membership = (
        db.query(Membership)
        .filter(
            Membership.client_id == client.id,
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True
        )
        .order_by(Membership.end_date.desc())
        .first()
    )

    membership_summary = None
    if membership:
        days_left = (membership.end_date.replace(tzinfo=timezone.utc) - now).days
        if days_left < 0: days_left = 0
        
        # dynamic status update just for display if it's expired
        display_status = membership.status
        if membership.end_date.replace(tzinfo=timezone.utc) < now and display_status == MembershipStatus.ACTIVE:
            display_status = MembershipStatus.EXPIRED

        membership_summary = ClientMembershipSummary(
            id=membership.id,
            plan_name=membership.membership_plan.name if membership.membership_plan else "Desconocido",
            status=display_status,
            start_date=membership.start_date,
            end_date=membership.end_date,
            days_left=days_left,
            trainer_name=membership.trainer_name
        )

    # 2. Financial Summary
    # Last payment
    last_payment = (
        db.query(Payment)
        .filter(
            Payment.gym_id == current_user.gym_id,
            Payment.status == "PAID",
            Payment.is_active == True,
        )
        .join(Membership, Payment.membership_id == Membership.id, isouter=True)
        .join(Sale, Payment.sale_id == Sale.id, isouter=True)
        .join(AccountsReceivable, Payment.accounts_receivable_id == AccountsReceivable.id, isouter=True)
        .filter(
            or_(
                Membership.client_id == client.id,
                Sale.client_id == client.id,
                AccountsReceivable.client_id == client.id
            )
        )
        .order_by(Payment.created_at.desc())
        .first()
    )

    # Total paid
    from sqlalchemy import func
    total_paid_memberships = db.query(func.sum(Payment.amount)).join(Membership).filter(
        Membership.client_id == client.id, Payment.status == "PAID", Payment.is_active == True
    ).scalar() or Decimal("0.00")
    
    total_paid_sales = db.query(func.sum(Payment.amount)).join(Sale).filter(
        Sale.client_id == client.id, Payment.status == "PAID", Payment.is_active == True
    ).scalar() or Decimal("0.00")
    
    total_paid_ar = db.query(func.sum(Payment.amount)).join(AccountsReceivable).filter(
        AccountsReceivable.client_id == client.id, Payment.status == "PAID", Payment.is_active == True
    ).scalar() or Decimal("0.00")
    
    total_paid = total_paid_memberships + total_paid_sales + total_paid_ar

    # Pending balance and overdue
    ar_records = db.query(AccountsReceivable).filter(
        AccountsReceivable.client_id == client.id,
        AccountsReceivable.gym_id == current_user.gym_id,
        AccountsReceivable.status == "PENDING",
        AccountsReceivable.is_active == True
    ).all()
    
    pending_balance = sum([ar.balance_due for ar in ar_records])
    
    # ensure tz comparison
    overdue_balance = sum([
        ar.balance_due for ar in ar_records 
        if ar.due_date and ar.due_date.replace(tzinfo=timezone.utc) < now
    ])
    active_credits_count = len(ar_records)

    # Last purchase
    last_purchase = (
        db.query(Sale)
        .filter(
            Sale.client_id == client.id,
            Sale.gym_id == current_user.gym_id,
            Sale.is_active == True
        )
        .order_by(Sale.created_at.desc())
        .first()
    )

    financial = ClientFinancialSummary(
        last_payment_date=last_payment.created_at if last_payment else None,
        last_payment_amount=last_payment.amount if last_payment else None,
        total_paid=total_paid,
        pending_balance=pending_balance,
        overdue_balance=overdue_balance,
        active_credits_count=active_credits_count,
        last_purchase_date=last_purchase.created_at if last_purchase else None
    )

    return Client360Response(
        client=ClientResponse.model_validate(client),
        current_membership=membership_summary,
        financial=financial
    )

# ==========================
# Actualizar cliente
# ==========================

@router.put(
    "/{client_id}",
    response_model=ClientResponse,
)
def update_client(
    client_id: int,
    client_data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.gym_id == current_user.gym_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    update_data = client_data.model_dump(exclude_unset=True)

    # Validar documento duplicado
    if "document" in update_data:
        existing_client = (
            db.query(Client)
            .filter(
                Client.gym_id == current_user.gym_id,
                Client.document == update_data["document"],
                Client.id != client_id,
            )
            .first()
        )

        if existing_client:
            raise HTTPException(
                status_code=400,
                detail="Another client already has this document.",
            )

    for key, value in update_data.items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)

    return client


# ==========================
# Desactivar cliente
# ==========================

@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.gym_id == current_user.gym_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    client.is_active = False

    db.commit()


# ==========================
# Upload client photo
# ==========================

UPLOAD_DIR = "uploads/clients"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post(
    "/{client_id}/photo",
    response_model=ClientResponse,
)
def upload_client_photo(
    client_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    client = (
        db.query(Client)
        .filter(
            Client.id == client_id,
            Client.gym_id == current_user.gym_id,
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Generate safe filename
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    if not ext.isalnum():
        ext = "jpg"
        
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Delete old photo if it exists locally
    if client.photo_url and client.photo_url.startswith("/clients/photo/"):
        old_filename = client.photo_url.split("/")[-1]
        old_path = os.path.join(UPLOAD_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)

    client.photo_url = f"/clients/photo/{filename}"
    db.commit()
    db.refresh(client)

    return client


@router.get("/photo/{filename}")
def get_client_photo(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # RLS: the photo_url format is /clients/photo/{filename}
    # We must ensure the client with this photo_url belongs to the current user's gym
    client = (
        db.query(Client)
        .filter(
            Client.gym_id == current_user.gym_id,
            Client.photo_url == f"/clients/photo/{filename}",
        )
        .first()
    )

    if not client:
        raise HTTPException(status_code=404, detail="Photo not found or unauthorized.")

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(file_path)