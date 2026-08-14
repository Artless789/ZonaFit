from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

class AccountsReceivableBase(BaseModel):
    original_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    due_date: datetime | None = None
    status: str

class AccountsReceivableCreate(AccountsReceivableBase):
    gym_id: int
    client_id: int
    sale_id: int

class AccountsReceivableUpdate(BaseModel):
    paid_amount: Optional[Decimal] = None
    balance_due: Optional[Decimal] = None
    status: Optional[str] = None
    due_date: Optional[datetime] = None

class AccountsReceivableInDBBase(AccountsReceivableBase):
    id: int
    gym_id: int
    client_id: int
    sale_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AccountsReceivableResponse(AccountsReceivableInDBBase):
    pass
