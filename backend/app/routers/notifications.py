from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.database.database import get_db
from app.exceptions.not_found_exception import NotFoundException
from app.models.user import User
from app.schemas.notification import NotificationResponse, NotificationSendRequest
from app.schemas.notification_template import (
    NotificationTemplateCreate,
    NotificationTemplateResponse,
    NotificationTemplateUpdate,
)
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.schemas.sort import SortParams
from app.models.client import Client
from app.services.notification_service import NotificationService, is_valid_phone, normalize_phone_co
from app.services.notification_template_service import NotificationTemplateService

# ── Templates router ───────────────────────────────────────────────────────────

templates_router = APIRouter(
    prefix="/notification-templates",
    tags=["Notification Templates"],
)


@templates_router.get(
    "/",
    response_model=PaginationResponse[NotificationTemplateResponse],
    summary="List notification templates",
    description=(
        "Returns paginated notification templates for the gym. "
        "Filter by event_type, channel, or is_active. Requires admin role."
    ),
)
def list_templates(
    event_type: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return NotificationTemplateService.get_all(
        db=db,
        current_user=current_user,
        params=params,
        sort=sort,
        event_type=event_type,
        channel=channel,
        is_active=is_active,
    )


@templates_router.get(
    "/{template_id:int}",
    response_model=NotificationTemplateResponse,
    summary="Get notification template",
)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        return NotificationTemplateService.get_by_id(db, current_user, template_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e.message))


@templates_router.post(
    "/",
    response_model=NotificationTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create notification template",
    description=(
        "Creates a message template for a specific event type and channel. "
        "Only one active template per (event_type, channel) per gym. "
        "Supported variables: {client_name}, {expiry_date}, {gym_name}, {amount}, {plan_name}. "
        "Requires admin role."
    ),
)
def create_template(
    data: NotificationTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return NotificationTemplateService.create(db, current_user, data)


@templates_router.put(
    "/{template_id:int}",
    response_model=NotificationTemplateResponse,
    summary="Update notification template",
    description=(
        "Updates template_body or is_active. "
        "To deactivate a template, set is_active=false. Requires admin role."
    ),
)
def update_template(
    template_id: int,
    data: NotificationTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    try:
        template = NotificationTemplateService.get_by_id(db, current_user, template_id)
    except NotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e.message))

    return NotificationTemplateService.update(db, template, data)


# ── Notifications router ───────────────────────────────────────────────────────

notifications_router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


@notifications_router.get(
    "/",
    response_model=PaginationResponse[NotificationResponse],
    summary="List notifications",
    description=(
        "Returns paginated notification history for the gym. "
        "Filter by status (PENDING, SENT, FAILED), event_type or client_id. "
        "Default order: newest first. Requires admin role."
    ),
)
def list_notifications(
    status_filter: Optional[str] = Query(
        default=None, alias="status",
        description="Filter by status: PENDING, SENT or FAILED.",
    ),
    event_type: Optional[str] = Query(default=None),
    client_id: Optional[int] = Query(default=None),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return NotificationService.get_all(
        db=db,
        current_user=current_user,
        params=params,
        sort=sort,
        status=status_filter,
        event_type=event_type,
        client_id=client_id,
    )


@notifications_router.get(
    "/whatsapp-status",
    summary="Check WhatsApp configuration status",
    description="Returns whether the WhatsApp Business API is configured. No credentials are exposed.",
)
def whatsapp_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    configured = NotificationService.whatsapp_configured(db=db, gym_id=current_user.gym_id)
    return {
        "configured": configured,
        "channel": "WHATSAPP",
        "message": (
            "WhatsApp listo para enviar mensajes."
            if configured
            else "WhatsApp no configurado. Conecta tu cuenta de WhatsApp Business desde la configuración."
        ),
    }


@notifications_router.post(
    "/send",
    response_model=NotificationResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Manually send a notification",
    description=(
        "Creates a PENDING notification and immediately queues it for sending "
        "as a background task. Returns the notification record with status=PENDING. "
        "The status will update to SENT or FAILED asynchronously. Requires admin role."
    ),
)
def send_notification(
    data: NotificationSendRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not is_valid_phone(data.recipient):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El número de teléfono del destinatario no tiene un formato válido.",
        )

    if data.client_id:
        client = (
            db.query(Client)
            .filter(
                Client.id == data.client_id,
                Client.gym_id == current_user.gym_id,
                Client.is_active == True,
            )
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado en este gimnasio.",
            )

    normalized_recipient = normalize_phone_co(data.recipient)

    notification = NotificationService.dispatch(
        db=db,
        gym_id=current_user.gym_id,
        client_id=data.client_id,
        event_type=data.event_type,
        channel=data.channel,
        recipient=normalized_recipient,
        message_body=data.message_body,
    )

    background_tasks.add_task(
        NotificationService.send_and_update,
        notification_id=notification.id,
    )

    return notification


@notifications_router.get(
    "/history",
    response_model=PaginationResponse[NotificationResponse],
    summary="List notification history",
    description="Alias endpoint for list_notifications.",
)
def list_notification_history(
    status_filter: Optional[str] = Query(
        default=None, alias="status",
        description="Filter by status: PENDING, SENT or FAILED.",
    ),
    event_type: Optional[str] = Query(default=None),
    client_id: Optional[int] = Query(default=None),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return NotificationService.get_all(
        db=db,
        current_user=current_user,
        params=params,
        sort=sort,
        status=status_filter,
        event_type=event_type,
        client_id=client_id,
    )


@notifications_router.get(
    "/templates",
    response_model=PaginationResponse[NotificationTemplateResponse],
    summary="List notification templates alias",
    description="Returns notification templates under notifications namespace.",
)
def list_notification_templates_alias(
    event_type: Optional[str] = Query(default=None),
    channel: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return NotificationTemplateService.get_all(
        db=db,
        current_user=current_user,
        params=params,
        sort=sort,
        event_type=event_type,
        channel=channel,
        is_active=is_active,
    )


@notifications_router.get(
    "/{notification_id:int}",
    response_model=NotificationResponse,
    summary="Get notification by ID",
)
def get_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    entry = NotificationService.get_by_id(db, current_user, notification_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found.",
        )
    return entry
