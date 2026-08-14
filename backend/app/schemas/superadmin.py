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
