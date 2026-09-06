from decimal import Decimal
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class PaymentBase(BaseModel):
    membership_id: int | None = None
    sale_id: int | None = None
    accounts_receivable_id: int | None = None
    amount: Decimal | None = None
    payment_method: Literal["CASH", "CARD", "TRANSFER"]
    reference: str | None = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    payment_method: Literal["CASH", "CARD", "TRANSFER"] | None = None
    reference: str | None = None
    status: str | None = None
    is_active: bool | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    membership_id: int | None = None
    sale_id: int | None = None
    accounts_receivable_id: int | None = None

    amount: Decimal

    payment_method: str
    reference: str | None

    status: str
    is_active: bool

    created_at: datetime
    updated_at: datetime