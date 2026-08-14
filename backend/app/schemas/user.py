from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    role: str = Field(..., description="Role of the user (e.g. ADMIN, STAFF)")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    gym_id: Optional[int] = None
    is_active: bool

    class Config:
        from_attributes = True
