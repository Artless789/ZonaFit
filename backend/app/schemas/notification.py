from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.constants.notification_channels import NotificationChannel
from app.constants.notification_event_types import NotificationEventType

VALID_CHANNELS = {NotificationChannel.WHATSAPP}
VALID_EVENT_TYPES = {
    NotificationEventType.MEMBERSHIP_EXPIRY,
    NotificationEventType.MEMBERSHIP_SOLD,
    NotificationEventType.MEMBERSHIP_EXPIRED,
    NotificationEventType.PAYMENT_RECEIVED,
    NotificationEventType.PAYMENT_OVERDUE,
    NotificationEventType.CREDIT_CREATED,
    NotificationEventType.CREDIT_PAYMENT_RECEIVED,
    NotificationEventType.CREDIT_OVERDUE,
    NotificationEventType.WELCOME,
    NotificationEventType.GENERAL,
}


class NotificationSendRequest(BaseModel):
    """
    Payload for the manual send endpoint (POST /notifications/send).
    Used by admins to trigger a notification directly.
    """
    client_id: Optional[int] = None
    event_type: str
    channel: str
    recipient: str
    message_body: str

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES:
            raise ValueError(
                f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}."
            )
        return v

    @field_validator("channel")
    @classmethod
    def validate_channel(cls, v: str) -> str:
        if v.upper() not in VALID_CHANNELS:
            raise ValueError(
                f"channel must be one of: {', '.join(VALID_CHANNELS)}."
            )
        return v.upper()

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("recipient cannot be empty.")
        return stripped

    @field_validator("message_body")
    @classmethod
    def validate_message_body(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message_body cannot be empty.")
        return v


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    client_id: Optional[int] = None
    event_type: str
    channel: str
    recipient: str
    message_body: str
    status: str
    error_detail: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
