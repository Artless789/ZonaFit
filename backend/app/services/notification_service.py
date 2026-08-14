from datetime import datetime, timezone
import re
from typing import Optional

from sqlalchemy.orm import Session

from app.constants.notification_statuses import NotificationStatus
from app.database.database import SessionLocal
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.models.user import User
from app.schemas.pagination import PaginationParams
from app.schemas.sort import SortParams
from app.services.whatsapp_sender import WhatsAppSender
from app.utils.query import paginate, apply_sort


class _SafeFormatMap(dict):
    """
    dict subclass that returns '{key}' for missing keys instead of raising
    KeyError, making template rendering safe when the caller omits some variables.
    """
    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"


def normalize_phone_co(phone: str) -> str:
    """
    Normalizes a Colombian phone number to E.164 format for WhatsApp.
    - Strips spaces, dashes, parentheses and leading '+'
    - If starts with '57', keeps as-is
    - If starts with '3' and has 10 digits, prepends '57'
    - Otherwise returns the number cleaned but does NOT add country code.
    """
    cleaned = re.sub(r"[\s\-()]+", "", phone).lstrip("+")
    if not cleaned:
        return ""
    if cleaned.startswith("57") and len(cleaned) == 12:
        return cleaned
    if cleaned.startswith("3") and len(cleaned) == 10:
        return "57" + cleaned
    return cleaned


def is_valid_phone(phone: str) -> bool:
    """Returns True only if the phone looks like a valid E.164 number (digits only, 8-15 chars)."""
    cleaned = re.sub(r"[\s\-()]+", "", phone).lstrip("+")
    return bool(re.fullmatch(r"\d{8,15}", cleaned))


class NotificationService:

    @staticmethod
    def dispatch(
        db: Session,
        gym_id: int,
        event_type: str,
        channel: str,
        recipient: str,
        message_body: str,
        client_id: Optional[int] = None,
    ) -> Notification:
        """
        Creates a PENDING notification record and commits it to the database.
        The actual sending must be triggered separately via send_and_update().

        This method is intentionally independent of the caller's transaction:
        the notification record is persisted even if the parent operation fails,
        enabling retry logic and a complete audit trail.
        """
        notification = Notification(
            gym_id=gym_id,
            client_id=client_id,
            event_type=event_type,
            channel=channel,
            recipient=recipient,
            message_body=message_body,
            status=NotificationStatus.PENDING,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def dispatch_from_template(
        db: Session,
        gym_id: int,
        event_type: str,
        channel: str,
        recipient: str,
        context: dict,
        client_id: Optional[int] = None,
    ) -> Optional[Notification]:
        """
        Finds the active template for (gym_id, event_type, channel),
        renders the message body using context variables, and creates
        a PENDING notification.

        Returns None if:
          - No active template is found for the given combination.
          - The recipient phone is empty or invalid.

        Supported template variables (use {variable_name} syntax):
            {client_name}              - Client's full name
            {gym_name}                 - Gym trade name (from GymSettings)
            {membership_name}          - Membership plan name
            {expiry_date}              - Membership expiry date (formatted)
            {days_left}                - Days remaining until expiry
            {amount}                   - Payment or membership price amount
            {payment_method}           - Payment method (CASH, CARD, etc.)
            {balance_due}              - Outstanding balance in accounts receivable
            {invoice_number}           - Invoice/receipt number
            {payment_date}             - Date of payment
            {plan_name}                - Alias for membership_name (legacy)
        """
        if not recipient or not is_valid_phone(recipient):
            return None

        normalized = normalize_phone_co(recipient)

        template = (
            db.query(NotificationTemplate)
            .filter(
                NotificationTemplate.gym_id == gym_id,
                NotificationTemplate.event_type == event_type,
                NotificationTemplate.channel == channel,
                NotificationTemplate.is_active.is_(True),
            )
            .first()
        )

        if not template:
            return None

        rendered_body = template.template_body.format_map(
            _SafeFormatMap(context)
        )

        return NotificationService.dispatch(
            db=db,
            gym_id=gym_id,
            client_id=client_id,
            event_type=event_type,
            channel=channel,
            recipient=normalized,
            message_body=rendered_body,
        )

    @staticmethod
    def send_and_update(notification_id: int) -> None:
        """
        Background task: opens its own DB session, sends the notification via
        the appropriate channel, and updates the record to SENT or FAILED.

        Designed to run as a FastAPI BackgroundTask after the response is sent.
        """
        db: Session = SessionLocal()

        try:
            notification = (
                db.query(Notification)
                .filter(Notification.id == notification_id)
                .first()
            )

            if not notification or notification.status != NotificationStatus.PENDING:
                return

            try:
                WhatsAppSender.send_text(
                    to_phone=notification.recipient,
                    body=notification.message_body,
                )
                notification.status = NotificationStatus.SENT
                notification.sent_at = datetime.now(timezone.utc)

            except (ValueError, RuntimeError) as exc:
                notification.status = NotificationStatus.FAILED
                notification.error_detail = str(exc)

            db.commit()

        finally:
            db.close()

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        params: PaginationParams,
        sort: SortParams,
        status: Optional[str] = None,
        event_type: Optional[str] = None,
        client_id: Optional[int] = None,
    ):
        query = (
            db.query(Notification)
            .filter(Notification.gym_id == current_user.gym_id)
        )

        if status:
            query = query.filter(Notification.status == status.upper())
        if event_type:
            query = query.filter(Notification.event_type == event_type)
        if client_id:
            query = query.filter(Notification.client_id == client_id)

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "created_at": Notification.created_at,
                "status": Notification.status,
                "event_type": Notification.event_type,
            },
        )

        if not sort.sort:
            query = query.order_by(Notification.created_at.desc())

        return paginate(query=query, params=params)

    @staticmethod
    def whatsapp_configured() -> bool:
        """Returns True if WhatsApp credentials are set in the environment."""
        return WhatsAppSender.is_configured()

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        notification_id: int,
    ) -> Optional[Notification]:
        return (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.gym_id == current_user.gym_id,
            )
            .first()
        )
