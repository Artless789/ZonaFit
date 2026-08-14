from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SaleDetailBase(BaseModel):
    sale_id: int
    product_id: int
    quantity: int


class SaleDetailCreate(SaleDetailBase):
    pass


class SaleDetailUpdate(BaseModel):
    quantity: int | None = None


class SaleDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    sale_id: int
    product_id: int

    quantity: int

    unit_price: Decimal

    subtotal: Decimal

    created_at: datetime