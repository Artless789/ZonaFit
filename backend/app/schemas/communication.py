from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class CommunicationPrepareRequest(BaseModel):
    client_id: int
    event_type: str = Field(..., description="Event type, e.g. MEMBERSHIP_EXPIRY, MEMBERSHIP_EXPIRED, CREDIT_OVERDUE, PAYMENT_RECEIVED, WELCOME, GENERAL")
    context_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CommunicationPrepareResponse(BaseModel):
    client_id: int
    client_name: str
    phone: str
    raw_phone: Optional[str] = None
    rendered_message: str
    event_type: str
    channel: str = "WHATSAPP_WEB"


class CommunicationRecordOpenedRequest(BaseModel):
    client_id: int
    event_type: str
    recipient: str
    message_body: str


class CommunicationRecordOpenedResponse(BaseModel):
    success: bool
    notification_id: int
