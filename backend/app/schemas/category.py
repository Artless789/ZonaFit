from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class CategoryResponse(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    gym_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime