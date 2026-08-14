from decimal import Decimal
from datetime import datetime

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

class SaleCompleteRequest(BaseModel):
    sale_type: str  # "CASH" or "CREDIT"
    payment_method: str | None = None  # e.g., "CASH", "CARD", "WOMPI"
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

    is_active: bool

    created_at: datetime
    updated_at: datetime