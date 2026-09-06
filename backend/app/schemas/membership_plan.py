from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MembershipPlanBase(BaseModel):
    name: str
    description: str | None = None
    duration_days: int = Field(gt=0, description="Duración en días (debe ser mayor a 0)")
    price: Decimal = Field(ge=0, description="Precio del plan (no puede ser negativo)")


class MembershipPlanCreate(MembershipPlanBase):
    pass


class MembershipPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_days: int | None = Field(default=None, gt=0, description="Duración en días (debe ser mayor a 0)")
    price: Decimal | None = Field(default=None, ge=0, description="Precio del plan (no puede ser negativo)")
    is_active: bool | None = None


class MembershipPlanResponse(MembershipPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime