from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InventoryMovementBase(BaseModel):
    product_id: int
    movement_type: str
    quantity: int
    reason: str | None = None


class InventoryMovementCreate(InventoryMovementBase):
    pass


class InventoryMovementUpdate(BaseModel):
    reason: str | None = None


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    gym_id: int
    product_id: int

    movement_type: str

    quantity: int

    stock_before: int

    stock_after: int

    reason: str | None

    created_at: datetime