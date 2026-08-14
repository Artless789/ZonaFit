from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.plan import BillingInterval

class PlanBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price: float
    currency: str = "COP"
    billing_interval: BillingInterval = BillingInterval.MONTHLY
    is_active: bool = True

class PlanCreate(PlanBase):
    pass

class PlanUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    billing_interval: Optional[BillingInterval] = None
    is_active: Optional[bool] = None

class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
