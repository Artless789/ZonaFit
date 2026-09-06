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
    cancellation_requested_at: Optional[datetime] = None
    payment_method_last4: Optional[str] = None
    payment_method_type: Optional[str] = None
    is_in_grace_period: bool = False
    grace_period_ends_at: Optional[datetime] = None
    days_left_in_grace: Optional[int] = None
    can_request_emergency_extension: bool = True
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

class SubscriptionCancelRequest(BaseModel):
    reason: Optional[str] = None
    feedback: Optional[str] = None

class SubscriptionEmergencyResponse(BaseModel):
    success: bool
    message: str
    new_ends_at: datetime

