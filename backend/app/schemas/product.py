from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductBase(BaseModel):
    category_id: int
    name: str
    description: str | None = None
    sku: str
    purchase_price: Decimal
    sale_price: Decimal
    stock: int
    minimum_stock: int


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    category_id: int | None = None
    name: str | None = None
    description: str | None = None
    sku: str | None = None
    purchase_price: Decimal | None = None
    sale_price: Decimal | None = None
    stock: int | None = None
    minimum_stock: int | None = None
    is_active: bool | None = None


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime