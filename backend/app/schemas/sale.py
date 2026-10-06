from decimal import Decimal
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SaleBase(BaseModel):
    client_id: int | None = None
    notes: str | None = None


class SaleCreate(SaleBase):
    pass


class SaleUpdate(BaseModel):
    notes: str | None = None
    status: str | None = None
    is_active: bool | None = None

class SaleItemCheckout(BaseModel):
    product_id: int
    quantity: int


class SaleCheckoutRequest(BaseModel):
    client_id: int | None = None
    notes: str | None = None
    items: list[SaleItemCheckout]
    sale_type: str = "CASH"  # "CASH" or "CREDIT"
    payment_method: Literal["CASH", "CARD", "TRANSFER"] | None = None
    due_date: datetime | None = None
    initial_payment: Decimal = Decimal("0.00")


class SaleCompleteRequest(BaseModel):
    sale_type: str  # "CASH" or "CREDIT"
    payment_method: Literal["CASH", "CARD", "TRANSFER"] | None = None
    due_date: datetime | None = None
    initial_payment: Decimal = Decimal("0.00")


class SaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    client_id: int | None

    total: Decimal

    status: str

    notes: str | None

    origin_type: str = "POS"
    is_membership_shadow: bool = False

    is_active: bool

    created_at: datetime
    updated_at: datetime