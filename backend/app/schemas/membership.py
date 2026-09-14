from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ClientMembershipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    document_type: str
    document: str
    phone: str
    email: str | None = None
    photo_url: str | None = None
    notes: str | None = None


class PlanMembershipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    duration_days: int
    price: float


class PaymentMembershipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    payment_method: str
    reference: str | None = None
    status: str
    created_at: datetime


from decimal import Decimal


class MembershipBase(BaseModel):
    client_id: int
    membership_plan_id: int
    trainer_name: str | None = None


class MembershipCreate(MembershipBase):
    start_date: datetime | None = None
    discount: Decimal | None = Decimal("0.00")
    register_payment: bool = False
    payment_method: Literal["CASH", "CARD", "TRANSFER"] | None = None
    amount_paid: Decimal | None = None
    reference: str | None = None


class MembershipUpdate(BaseModel):
    status: str | None = None
    is_active: bool | None = None
    trainer_name: str | None = None


class MembershipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    client_id: int
    membership_plan_id: int

    start_date: datetime
    end_date: datetime

    base_price: float | None = None
    discount: float = 0.0
    price: float

    status: str
    is_active: bool
    trainer_name: str | None = None

    client: ClientMembershipSummary | None = None
    client_name: str | None = None
    membership_plan: PlanMembershipSummary | None = None
    plan_name: str | None = None
    payments: list[PaymentMembershipSummary] = []
    total_paid: float = 0.0
    pending_balance: float = 0.0

    created_at: datetime
    updated_at: datetime