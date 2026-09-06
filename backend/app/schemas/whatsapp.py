from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class WhatsAppIntegrationConnect(BaseModel):
    phone_number_id: str
    access_token: str
    waba_id: Optional[str] = None
    business_id: Optional[str] = None
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None

class WhatsAppIntegrationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    phone_number_id: str
    waba_id: Optional[str] = None
    business_id: Optional[str] = None
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    status: str
    quality_rating: str
    last_error: Optional[str] = None
    is_active: bool
    connected_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class WhatsAppTestMessageRequest(BaseModel):
    to_phone: str
    message: Optional[str] = "Mensaje de prueba desde Merwil ZonaFit"

class WhatsAppMetaConfigResponse(BaseModel):
    app_id: Optional[str] = None
    config_id: Optional[str] = None
    api_version: str = "v22.0"
    is_configured: bool = False

class WhatsAppEmbeddedSignupRequest(BaseModel):
    code: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    business_id: Optional[str] = None

class WhatsAppStatusResponse(BaseModel):
    configured: bool
    channel: str = "WHATSAPP"
    status: str
    message: str
    integration: Optional[WhatsAppIntegrationResponse] = None

