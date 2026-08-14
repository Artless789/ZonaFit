from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InvoiceBase(BaseModel):
    sale_id: int


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    status: str | None = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    gym_id: int

    sale_id: int

    client_id: int | None = None

    invoice_number: str

    subtotal: Decimal

    tax: Decimal

    discount: Decimal

    total: Decimal

    status: str

    is_active: bool

    created_at: datetime

    updated_at: datetime