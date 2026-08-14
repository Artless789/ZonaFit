from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InvoiceDetailBase(BaseModel):
    invoice_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class InvoiceDetailCreate(InvoiceDetailBase):
    pass


class InvoiceDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    invoice_id: int

    product_id: int

    quantity: int

    unit_price: Decimal

    subtotal: Decimal

    created_at: datetime