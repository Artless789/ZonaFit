from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.constants.notification_channels import NotificationChannel
from app.constants.notification_event_types import NotificationEventType


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
    NotificationEventType.GROUP_INVITATION,
}

VALID_CHANNELS = {
    NotificationChannel.WHATSAPP,
    NotificationChannel.WHATSAPP_WEB,
    NotificationChannel.WHATSAPP_CLOUD_API,
}


class NotificationTemplateBase(BaseModel):
    event_type: str
    channel: str
    template_body: str
    custom_event_name: Optional[str] = None
    description: Optional[str] = None

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, v: str) -> str:
        if v not in VALID_EVENT_TYPES and not v.startswith("CUSTOM_") and v != "CUSTOM":
            raise ValueError(
                f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)} or start with 'CUSTOM_'."
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

    @field_validator("template_body")
    @classmethod
    def validate_template_body(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("template_body cannot be empty.")
        return v


class NotificationTemplateCreate(NotificationTemplateBase):
    pass


class NotificationTemplateUpdate(BaseModel):
    template_body: Optional[str] = None
    is_active: Optional[bool] = None
    custom_event_name: Optional[str] = None
    description: Optional[str] = None

    @field_validator("template_body")
    @classmethod
    def validate_template_body(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("template_body cannot be empty.")
        return v


class NotificationTemplateResponse(NotificationTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
