from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr

class SuperadminGymResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    onboarding_completed: bool
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    current_plan_name: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_starts_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
class GymDetailUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool

class SuperadminPaymentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    reference: str
    amount_in_cents: int
    currency: str
    status: str
    provider_transaction_id: Optional[str] = None
    refund_reason: Optional[str] = None
    refunded_at: Optional[datetime] = None
    created_at: datetime

class SuperadminGymDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool
    onboarding_completed: bool
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    
    # Subscription info
    subscription_id: Optional[int] = None
    current_plan_id: Optional[int] = None
    current_plan_name: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_starts_at: Optional[datetime] = None
    subscription_ends_at: Optional[datetime] = None
    is_lifetime: bool = False
    
    # Metrics
    total_users: int = 0
    total_clients: int = 0
    
    # Team members
    users: list[GymDetailUser] = []

    # Payments history
    payments: list[SuperadminPaymentItem] = []

class SuperadminRefundRequest(BaseModel):
    reason: str
    revoke_access_immediately: bool = False

class SuperadminRefundResponse(BaseModel):
    success: bool
    message: str
    status: str
    wompi_response: Optional[dict] = None

class SuperadminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    gym_id: Optional[int] = None
    full_name: str
    email: EmailStr
    role: str
    is_active: bool

class SuperadminAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    gym_id: int
    user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    created_at: datetime
    ip_address: Optional[str] = None

class SuperadminDashboardMetrics(BaseModel):
    total_gyms: int
    active_gyms: int
    inactive_gyms: int
    pending_onboarding_gyms: int
    total_users: int
    total_superadmins: int
    active_subscriptions: int
    trial_subscriptions: int
    expired_subscriptions: int
    active_plans: int
    total_revenue: float
