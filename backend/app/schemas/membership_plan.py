from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MembershipPlanBase(BaseModel):
    name: str
    description: str | None = None
    duration_days: int
    price: Decimal


class MembershipPlanCreate(MembershipPlanBase):
    pass


class MembershipPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_days: int | None = None
    price: Decimal | None = None
    is_active: bool | None = None


class MembershipPlanResponse(MembershipPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime