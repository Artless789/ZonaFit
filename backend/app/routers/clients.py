from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse, Response
from app.services.client_excel_service import ClientExcelService
from app.schemas.client_excel import (
    ClientImportPreviewResponse,
    ClientImportApplyRequest,
    ClientImportApplyResponse,
)
import os
import uuid
import shutil
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.database.database import get_db
from app.core.database_transaction import DatabaseTransaction
from app.models.client import Client
from app.models.client_photo import ClientPhoto
from app.models.user import User
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    Client360Response,
    ClientMembershipSummary,
    ClientFinancialSummary,
    ClientMetricsResponse,
)
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.sale import Sale
from app.models.accounts_receivable import AccountsReceivable
from app.constants.membership_status import MembershipStatus
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.core.idempotency import IdempotentRoute

router = APIRouter(
    prefix="/clients",
    tags=["Clients"],
    route_class=IdempotentRoute
)


def summarize_membership_item(m: Membership, now: datetime) -> ClientMembershipSummary:
    start_utc = m.start_date.replace(tzinfo=timezone.utc) if m.start_date.tzinfo is None else m.start_date.astimezone(timezone.utc)
    end_utc = m.end_date.replace(tzinfo=timezone.utc) if m.end_date.tzinfo is None else m.end_date.astimezone(timezone.utc)

    if not getattr(m, "is_active", True) or m.status == MembershipStatus.CANCELLED:
        status_label = MembershipStatus.CANCELLED
        days_left = (end_utc.date() - now.date()).days
    elif start_utc > now:
        status_label = "FUTURE"
        days_left = (start_utc.date() - now.date()).days
    elif end_utc < now:
        status_label = MembershipStatus.EXPIRED
        days_left = (end_utc.date() - now.date()).days
    else:
        status_label = MembershipStatus.ACTIVE
        days_left = (end_utc.date() - now.date()).days

    return ClientMembershipSummary(
        id=m.id,
        plan_name=m.membership_plan.name if m.membership_plan else "Desconocido",
        status=status_label,
        start_date=m.start_date,
        end_date=m.end_date,
        days_left=days_left,
        trainer_name=m.trainer_name,
        price=m.price,
        is_active=bool(m.is_active),
        membership_plan_id=m.membership_plan_id,
    )


def resolve_client_memberships(memberships: list[Membership], now: datetime):
    if not memberships:
        return None, [], False

    summaries = [summarize_membership_item(m, now) for m in memberships]

    # Priority 1: ACTIVE
    active_items = [s for s in summaries if s.status == MembershipStatus.ACTIVE]
    if active_items:
        active_items.sort(key=lambda s: s.end_date, reverse=True)
        return active_items[0], summaries, True

    # Priority 2: FUTURE (closest start date)
    future_items = [s for s in summaries if s.status == "FUTURE"]
    if future_items:
        future_items.sort(key=lambda s: s.start_date)
        return future_items[0], summaries, True

    # Priority 3: EXPIRED (most recently expired)
    expired_items = [s for s in summaries if s.status == MembershipStatus.EXPIRED]
    if expired_items:
        expired_items.sort(key=lambda s: s.end_date, reverse=True)
        return expired_items[0], summaries, True

    # Priority 4: CANCELLED
    cancelled_items = [s for s in summaries if s.status == MembershipStatus.CANCELLED]
    if cancelled_items:
        cancelled_items.sort(key=lambda s: s.end_date, reverse=True)
        return cancelled_items[0], summaries, True

    return None, summaries, True


def populate_client_membership_info(client: Client, db: Session, gym_id: int) -> Client:
    now = datetime.now(timezone.utc)
    memberships = (
        db.query(Membership)
        .options(joinedload(Membership.membership_plan))
        .filter(
            Membership.client_id == client.id,
            Membership.gym_id == gym_id,
        )
        .order_by(Membership.start_date.desc(), Membership.created_at.desc())
        .all()
    )
    current_mem, _, has_history = resolve_client_memberships(memberships, now)
    setattr(client, "current_membership", current_mem)
    setattr(client, "has_membership_history", has_history)
    return client



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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    with DatabaseTransaction(db):
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

        if client.whatsapp_group_id:
            from app.models.whatsapp_group import WhatsAppGroup
            group = db.query(WhatsAppGroup).filter(
                WhatsAppGroup.id == client.whatsapp_group_id,
                WhatsAppGroup.gym_id == current_user.gym_id,
            ).first()
            if not group:
                raise HTTPException(
                    status_code=400,
                    detail="El grupo de WhatsApp no existe o pertenece a otro gimnasio.",
                )

        new_client = Client(
            gym_id=current_user.gym_id,
            full_name=client.full_name,
            document_type=client.document_type,
            document=client.document,
            phone=client.phone,
            email=client.email,
            notes=client.notes,
            photo_url=client.photo_url,
            whatsapp_opt_in=bool(client.whatsapp_opt_in),
            whatsapp_group_id=client.whatsapp_group_id,
        )

        db.add(new_client)
        db.flush()

        from app.services.audit_service import AuditService
        AuditService.log(
            db=db,
            gym_id=current_user.gym_id,
            action="CLIENT_CREATED",
            entity_type="CLIENT",
            user_id=current_user.id,
            entity_id=new_client.id,
            new_values={
                "full_name": new_client.full_name,
                "document": new_client.document,
                "email": new_client.email,
            },
            ip_address=None,
        )

        created_membership = None
        if client.initial_membership:
            from app.schemas.membership import MembershipCreate
            from app.services.membership_service import MembershipService

            mem_input = client.initial_membership
            membership_data = MembershipCreate(
                client_id=new_client.id,
                membership_plan_id=mem_input.membership_plan_id,
                trainer_name=mem_input.trainer_name,
                start_date=mem_input.start_date,
                discount=mem_input.discount,
                register_payment=mem_input.register_payment,
                payment_method=mem_input.payment_method,
                amount_paid=mem_input.amount_paid,
                reference=mem_input.reference,
            )

            try:
                created_membership = MembershipService.create(
                    db=db,
                    current_user=current_user,
                    membership_data=membership_data,
                    background_tasks=background_tasks,
                )
            except ValueError as ve:
                raise HTTPException(
                    status_code=400,
                    detail=str(ve),
                )

        db.refresh(new_client)

    if created_membership:
        setattr(new_client, "initial_membership", created_membership)
        curr = summarize_membership_item(created_membership, datetime.now(timezone.utc))
        setattr(new_client, "current_membership", curr)
        setattr(new_client, "has_membership_history", True)
    else:
        setattr(new_client, "current_membership", None)
        setattr(new_client, "has_membership_history", False)

    return new_client


from sqlalchemy import or_, and_
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
    filter_type: str | None = None,
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
                Client.phone.ilike(search_term),
                Client.email.ilike(search_term),
            )
        )

    if is_active is not None:
        query = query.filter(Client.is_active == is_active)

    if filter_type:
        now = datetime.now(timezone.utc)
        ft = filter_type.strip().lower()
        if ft == "active":
            query = query.filter(Client.is_active == True)
        elif ft == "inactive":
            query = query.filter(Client.is_active == False)
        elif ft == "expiring_membership":
            in_7_days = now + timedelta(days=7)
            subq = (
                db.query(Membership.client_id)
                .filter(
                    Membership.gym_id == current_user.gym_id,
                    Membership.is_active == True,
                    Membership.status == MembershipStatus.ACTIVE,
                    Membership.end_date >= now,
                    Membership.end_date <= in_7_days,
                )
            )
            query = query.filter(Client.id.in_(subq))
        elif ft == "expired_membership":
            active_mem_subq = db.query(Membership.client_id).filter(
                Membership.gym_id == current_user.gym_id,
                Membership.is_active == True,
                Membership.status == MembershipStatus.ACTIVE,
                Membership.end_date >= now,
            )
            expired_mem_subq = db.query(Membership.client_id).filter(
                Membership.gym_id == current_user.gym_id,
                Membership.is_active == True,
                Membership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
                Membership.end_date < now,
            )
            query = query.filter(
                Client.id.in_(expired_mem_subq),
                Client.id.not_in(active_mem_subq),
            )
        elif ft == "pending_balance":
            subq = (
                db.query(AccountsReceivable.client_id)
                .filter(
                    AccountsReceivable.gym_id == current_user.gym_id,
                    AccountsReceivable.status.in_(["PENDING", "PARTIAL"]),
                    AccountsReceivable.balance_due > 0,
                )
            )
            query = query.filter(Client.id.in_(subq))

    # Order by newest first
    query = query.order_by(Client.created_at.desc())

    total = query.count()
    total_pages = calculate_total_pages(total, page_size)

    offset = (page - 1) * page_size
    items = query.offset(offset).limit(page_size).all()

    if items:
        client_ids = [c.id for c in items]
        memberships = (
            db.query(Membership)
            .options(joinedload(Membership.membership_plan))
            .filter(
                Membership.client_id.in_(client_ids),
                Membership.gym_id == current_user.gym_id,
            )
            .order_by(Membership.start_date.desc(), Membership.created_at.desc())
            .all()
        )
        mems_by_client = {}
        for m in memberships:
            mems_by_client.setdefault(m.client_id, []).append(m)

        now = datetime.now(timezone.utc)
        for c in items:
            client_mems = mems_by_client.get(c.id, [])
            current_mem, _, has_history = resolve_client_memberships(client_mems, now)
            setattr(c, "current_membership", current_mem)
            setattr(c, "has_membership_history", has_history)

    return PaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )





# ==========================
# Exportar clientes (Excel)
# ==========================

@router.get("/export")
def export_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    excel_stream = ClientExcelService.export_clients_to_excel(db=db, gym_id=current_user.gym_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"clientes_zonafit_{current_user.gym_id}_{timestamp}.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ==========================
# Descargar plantilla oficial
# ==========================

@router.get("/import/template")
def download_import_template(
    current_user: User = Depends(get_current_user),
):
    excel_stream = ClientExcelService.generate_import_template()
    filename = "plantilla_clientes_zonafit.xlsx"

    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ==========================
# Previsualizar importación
# ==========================

@router.post(
    "/import/preview",
    response_model=ClientImportPreviewResponse,
)
def preview_client_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. El archivo debe ser un libro de Excel con extensión .xlsx.",
        )

    MAX_EXCEL_SIZE = 10 * 1024 * 1024
    if file.size and file.size > MAX_EXCEL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo excede el tamaño máximo permitido de 10MB.",
        )

    file_bytes = file.file.read()
    if len(file_bytes) > MAX_EXCEL_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo excede el tamaño máximo permitido de 10MB.",
        )

    return ClientExcelService.preview_import_excel(
        db=db,
        gym_id=current_user.gym_id,
        file_bytes=file_bytes,
    )


# ==========================
# Aplicar importación confirmada
# ==========================

@router.post(
    "/import/apply",
    response_model=ClientImportApplyResponse,
)
def apply_client_import(
    payload: ClientImportApplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ClientExcelService.apply_confirmed_import(
        db=db,
        current_user=current_user,
        payload=payload,
    )


# ==========================
# Métricas de clientes
# ==========================

@router.get(
    "/metrics",
    response_model=ClientMetricsResponse,
)
def get_client_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_clients = db.query(Client).filter(Client.gym_id == current_user.gym_id).count()
    active_accounts = db.query(Client).filter(
        Client.gym_id == current_user.gym_id,
        Client.is_active == True,
    ).count()
    inactive_accounts = total_clients - active_accounts

    now = datetime.now(timezone.utc)
    active_mem_subq = db.query(Membership.client_id).filter(
        Membership.gym_id == current_user.gym_id,
        Membership.is_active == True,
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date >= now,
    )
    active_memberships = db.query(Client.id).filter(
        Client.gym_id == current_user.gym_id,
        Client.id.in_(active_mem_subq),
    ).distinct().count()

    expired_mem_subq = db.query(Membership.client_id).filter(
        Membership.gym_id == current_user.gym_id,
        Membership.is_active == True,
        Membership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
        Membership.end_date < now,
    )
    expired_memberships = db.query(Client.id).filter(
        Client.gym_id == current_user.gym_id,
        Client.id.in_(expired_mem_subq),
        Client.id.not_in(active_mem_subq),
    ).distinct().count()

    return ClientMetricsResponse(
        total_clients=total_clients,
        active_accounts=active_accounts,
        inactive_accounts=inactive_accounts,
        active_memberships=active_memberships,
        expired_memberships=expired_memberships,
    )


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

    populate_client_membership_info(client, db, current_user.gym_id)
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

    # 1. Membership summary & history
    all_memberships = (
        db.query(Membership)
        .options(joinedload(Membership.membership_plan))
        .filter(
            Membership.client_id == client.id,
            Membership.gym_id == current_user.gym_id,
        )
        .order_by(Membership.start_date.desc(), Membership.created_at.desc())
        .all()
    )

    current_summary, history_summaries, has_history = resolve_client_memberships(all_memberships, now)
    history_summaries.sort(key=lambda s: s.start_date, reverse=True)

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

    populate_client_membership_info(client, db, current_user.gym_id)

    return Client360Response(
        client=ClientResponse.model_validate(client),
        current_membership=current_summary,
        membership_history=history_summaries,
        has_membership_history=has_history,
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

    if "whatsapp_group_id" in update_data and update_data["whatsapp_group_id"] is not None:
        from app.models.whatsapp_group import WhatsAppGroup
        group = db.query(WhatsAppGroup).filter(
            WhatsAppGroup.id == update_data["whatsapp_group_id"],
            WhatsAppGroup.gym_id == current_user.gym_id,
        ).first()
        if not group:
            raise HTTPException(
                status_code=400,
                detail="El grupo de WhatsApp no existe o pertenece a otro gimnasio.",
            )

    for key, value in update_data.items():
        setattr(client, key, value)

    db.commit()
    db.refresh(client)
    populate_client_membership_info(client, db, current_user.gym_id)

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
# Client photo management
# ==========================

import re
from app.core.config import settings

# Base upload directory from settings with fallback
UPLOAD_DIR = os.path.join(settings.UPLOADS_DIR, "clients")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Resilient fallback search paths
FALLBACK_UPLOAD_DIRS = [
    os.path.join(os.getcwd(), "uploads", "clients"),
    os.path.join(os.getcwd(), "backend", "uploads", "clients"),
    "/app/uploads/clients",
]

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
SAFE_FILENAME_REGEX = re.compile(r"^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$", re.IGNORECASE)


def validate_image_header(header: bytes) -> tuple[bool, str]:
    """Validate image magic bytes to prevent masqueraded executables or scripts."""
    if header.startswith(b"\xff\xd8\xff"):
        return True, "jpg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True, "png"
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
        return True, "webp"
    return False, ""


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

    # Validate declared MIME type
    if not file.content_type or file.content_type.lower() not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="File must be a valid image (JPEG, PNG, WEBP).",
        )

    # Validate file size if reported
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Validate actual file header magic bytes
    try:
        header_bytes = file.file.read(32)
        file.file.seek(0)
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read uploaded file.")

    is_valid_magic, detected_ext = validate_image_header(header_bytes)
    if not is_valid_magic:
        raise HTTPException(
            status_code=400,
            detail="File must be a valid image (JPEG, PNG, WEBP).",
        )

    # Generate server-side UUID filename
    original_filename = file.filename or ""
    original_ext = original_filename.split(".")[-1].lower() if "." in original_filename else ""
    ext = detected_ext or (original_ext if original_ext in ALLOWED_EXTENSIONS else "jpg")

    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        file.file.seek(0)
        file_bytes = file.file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Unable to read uploaded file.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Write file safely to disk cache
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)
    except Exception:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail="Failed to save uploaded photo.")

    # Save / update in persistent client_photos table (DB-backed persistence)
    photo_record = (
        db.query(ClientPhoto)
        .filter(
            ClientPhoto.client_id == client.id,
            ClientPhoto.gym_id == current_user.gym_id,
        )
        .first()
    )
    content_type = file.content_type or f"image/{ext}"
    if photo_record:
        photo_record.filename = filename
        photo_record.content_type = content_type
        photo_record.file_size = len(file_bytes)
        photo_record.data = file_bytes
    else:
        photo_record = ClientPhoto(
            gym_id=current_user.gym_id,
            client_id=client.id,
            filename=filename,
            content_type=content_type,
            file_size=len(file_bytes),
            data=file_bytes,
        )
        db.add(photo_record)

    # Preserve old photo filename for atomic cleanup ONLY after DB commit succeeds
    old_photo_url = client.photo_url
    client.photo_url = f"/clients/photo/{filename}"

    try:
        db.commit()
        db.refresh(client)
    except Exception:
        db.rollback()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail="Failed to update client record.")

    # Commit succeeded: remove old photo file safely
    if old_photo_url and old_photo_url.startswith("/clients/photo/"):
        old_filename = old_photo_url.split("/")[-1]
        for dir_path in [UPLOAD_DIR] + FALLBACK_UPLOAD_DIRS:
            old_path = os.path.join(dir_path, old_filename)
            if os.path.exists(old_path) and old_path != file_path:
                try:
                    os.remove(old_path)
                except OSError:
                    pass

    populate_client_membership_info(client, db, current_user.gym_id)
    return client


@router.delete(
    "/{client_id}/photo",
    response_model=ClientResponse,
)
def delete_client_photo(
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
        raise HTTPException(status_code=404, detail="Client not found.")

    old_photo_url = client.photo_url
    client.photo_url = None

    # Delete persistent ClientPhoto record if present
    photo_record = (
        db.query(ClientPhoto)
        .filter(
            ClientPhoto.client_id == client.id,
            ClientPhoto.gym_id == current_user.gym_id,
        )
        .first()
    )
    if photo_record:
        db.delete(photo_record)

    db.commit()
    db.refresh(client)

    if old_photo_url and old_photo_url.startswith("/clients/photo/"):
        old_filename = old_photo_url.split("/")[-1]
        for dir_path in [UPLOAD_DIR] + FALLBACK_UPLOAD_DIRS:
            old_path = os.path.join(dir_path, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass

    populate_client_membership_info(client, db, current_user.gym_id)
    return client


@router.get("/photo/{filename}")
def get_client_photo(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Strict filename verification: prevent directory traversal or non-uuid filenames
    if not SAFE_FILENAME_REGEX.match(filename) or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    # Multi-tenancy RLS: client must belong to current_user.gym_id
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
    if not os.path.isfile(file_path) or os.path.getsize(file_path) == 0:
        # Look in fallback directories and auto-migrate if found
        for fallback_dir in FALLBACK_UPLOAD_DIRS:
            candidate = os.path.join(fallback_dir, filename)
            if os.path.isfile(candidate) and os.path.getsize(candidate) > 0:
                try:
                    shutil.copy2(candidate, file_path)
                except Exception:
                    file_path = candidate
                break

    # 1. Fast Path: Cached on local disk with valid content -> return FileResponse
    if os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
        return FileResponse(file_path, headers={"Cache-Control": "private, max-age=86400"})

    # 2. Self-Healing Path: File missing from disk (e.g., after redeploy or container replacement)
    photo_record = (
        db.query(ClientPhoto)
        .filter(
            ClientPhoto.gym_id == current_user.gym_id,
            ClientPhoto.filename == filename,
        )
        .first()
    )

    if photo_record and photo_record.data:
        # Re-populate disk cache so next requests are served via Fast Path
        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(photo_record.data)
        except Exception:
            pass

        return Response(
            content=photo_record.data,
            media_type=photo_record.content_type,
            headers={"Cache-Control": "private, max-age=86400"},
        )

    raise HTTPException(status_code=404, detail="File not found on disk or database.")
