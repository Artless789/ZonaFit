from datetime import datetime
from typing import Optional, List
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ClientBase(BaseModel):
    full_name: str
    document_type: str
    document: str
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    document_type: Optional[str] = None
    document: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: Optional[bool] = None


class ClientResponse(ClientBase):
    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ClientMembershipSummary(BaseModel):
    id: int
    plan_name: str
    status: str
    start_date: datetime
    end_date: datetime
    days_left: int
    trainer_name: Optional[str] = None

class ClientFinancialSummary(BaseModel):
    last_payment_date: Optional[datetime] = None
    last_payment_amount: Optional[Decimal] = None
    total_paid: Decimal
    pending_balance: Decimal
    overdue_balance: Decimal
    active_credits_count: int
    last_purchase_date: Optional[datetime] = None

class Client360Response(BaseModel):
    client: ClientResponse
    current_membership: Optional[ClientMembershipSummary] = None
    financial: ClientFinancialSummary