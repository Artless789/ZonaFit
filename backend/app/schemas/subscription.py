from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from app.models.subscription import SubscriptionStatus
from .plan import PlanResponse

class SubscriptionBase(BaseModel):
    plan_id: Optional[int] = None
    status: SubscriptionStatus = SubscriptionStatus.TRIAL
    starts_at: datetime
    ends_at: Optional[datetime] = None
    is_lifetime: bool = False

class SubscriptionCreate(SubscriptionBase):
    pass

class SubscriptionUpdate(BaseModel):
    status: Optional[SubscriptionStatus] = None
    ends_at: Optional[datetime] = None
    is_lifetime: Optional[bool] = None

class SubscriptionResponse(SubscriptionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    created_at: datetime
    updated_at: datetime
    plan: Optional[PlanResponse] = None

class SubscriptionPaymentInitRequest(BaseModel):
    plan_id: int

class SubscriptionPaymentInitResponse(BaseModel):
    reference: str
    amount_in_cents: int
    currency: str
    signature: str
    public_key: str

class SubscriptionVerifyRequest(BaseModel):
    transaction_id: str

class SubscriptionStartRequest(BaseModel):
    intent: str # 'TRIAL' or 'PURCHASE'

