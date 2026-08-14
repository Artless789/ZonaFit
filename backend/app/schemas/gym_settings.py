from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


class GymSettingsBase(BaseModel):
    legal_name: str
    trade_name: str
    tax_id: str
    tax_regime: Optional[str] = None
    official_phone: str
    official_email: EmailStr
    physical_address: str
    city: str
    country: str = "Colombia"
    currency: str = "COP"
    timezone: str = "America/Bogota"
    default_tax_percentage: Decimal = Decimal("0.00")
    receipt_footer_notes: Optional[str] = None

    @field_validator("default_tax_percentage")
    @classmethod
    def validate_tax_percentage(cls, value: Decimal) -> Decimal:
        if value < Decimal("0.00") or value > Decimal("100.00"):
            raise ValueError(
                "default_tax_percentage must be between 0.00 and 100.00."
            )
        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        allowed = {"COP", "USD", "EUR"}
        if value.upper() not in allowed:
            raise ValueError(
                f"currency must be one of: {', '.join(allowed)}."
            )
        return value.upper()


class GymSettingsCreate(GymSettingsBase):
    pass


class GymSettingsUpdate(BaseModel):
    legal_name: Optional[str] = None
    trade_name: Optional[str] = None
    tax_id: Optional[str] = None
    tax_regime: Optional[str] = None
    official_phone: Optional[str] = None
    official_email: Optional[EmailStr] = None
    physical_address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    default_tax_percentage: Optional[Decimal] = None
    receipt_footer_notes: Optional[str] = None

    @field_validator("default_tax_percentage")
    @classmethod
    def validate_tax_percentage(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is not None:
            if value < Decimal("0.00") or value > Decimal("100.00"):
                raise ValueError(
                    "default_tax_percentage must be between 0.00 and 100.00."
                )
        return value

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            allowed = {"COP", "USD", "EUR"}
            if value.upper() not in allowed:
                raise ValueError(
                    f"currency must be one of: {', '.join(allowed)}."
                )
            return value.upper()
        return value


class GymSettingsResponse(GymSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    created_at: datetime
    updated_at: datetime
