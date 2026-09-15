from datetime import datetime
from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, field_validator


class WhatsAppGroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    invite_url: str
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre del grupo no puede estar vacío.")
        if len(v) > 100:
            raise ValueError("El nombre del grupo no puede exceder 100 caracteres.")
        return v

    @field_validator("invite_url")
    @classmethod
    def validate_invite_url(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El enlace de invitación no puede estar vacío.")

        # Strict security validation: HTTPS only
        if not v.startswith("https://"):
            raise ValueError("El enlace de invitación debe ser seguro y comenzar con https://")

        # Parse URL
        try:
            parsed = urlparse(v)
        except Exception:
            raise ValueError("El formato del enlace de invitación no es válido.")

        if parsed.scheme.lower() != "https":
            raise ValueError("Solo se admiten enlaces con protocolo HTTPS.")

        hostname = (parsed.netloc or "").lower()
        # Accept chat.whatsapp.com, wa.me, or whatsapp.com
        allowed_domains = ("chat.whatsapp.com", "wa.me", "whatsapp.com")
        if not any(hostname == d or hostname.endswith("." + d) for d in allowed_domains):
            raise ValueError(
                "El enlace de invitación debe ser un enlace oficial de WhatsApp (ej. https://chat.whatsapp.com/...)"
            )

        return v


class WhatsAppGroupCreate(WhatsAppGroupBase):
    pass


class WhatsAppGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    invite_url: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("El nombre del grupo no puede estar vacío.")
            if len(v) > 100:
                raise ValueError("El nombre del grupo no puede exceder 100 caracteres.")
        return v

    @field_validator("invite_url")
    @classmethod
    def validate_invite_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v.startswith("https://"):
                raise ValueError("El enlace de invitación debe ser seguro y comenzar con https://")
            try:
                parsed = urlparse(v)
            except Exception:
                raise ValueError("El formato del enlace de invitación no es válido.")
            if parsed.scheme.lower() != "https":
                raise ValueError("Solo se admiten enlaces con protocolo HTTPS.")
            hostname = (parsed.netloc or "").lower()
            allowed_domains = ("chat.whatsapp.com", "wa.me", "whatsapp.com")
            if not any(hostname == d or hostname.endswith("." + d) for d in allowed_domains):
                raise ValueError(
                    "El enlace de invitación debe ser un enlace oficial de WhatsApp (ej. https://chat.whatsapp.com/...)"
                )
        return v


class WhatsAppGroupResponse(WhatsAppGroupBase):
    id: int
    gym_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
