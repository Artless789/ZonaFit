from datetime import datetime
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field

class CashRegisterBase(BaseModel):
    opening_balance: Decimal = Field(default=0, ge=0)

class CashRegisterCreate(CashRegisterBase):
    pass

class PaymentMethodReconciliation(BaseModel):
    method: str
    registered_amount: Decimal = Field(default=Decimal("0.00"))
    verified_amount: Decimal = Field(default=Decimal("0.00"))
    difference: Decimal = Field(default=Decimal("0.00"))
    status: Optional[str] = None  # "CUADRADO", "SOBRANTE", "FALTANTE"

class PaymentMethodSummaryItem(BaseModel):
    method: str
    label: str
    registered_amount: Decimal

class CashRegisterSummaryResponse(BaseModel):
    register_id: int
    status: str
    opened_at: datetime
    opening_balance: Decimal
    cash_incomes: Decimal
    cash_outcomes: Decimal
    expected_cash: Decimal
    payment_methods: list[PaymentMethodSummaryItem]
    total_registered_income: Decimal

class CashRegisterClose(BaseModel):
    counted_balance: Decimal = Field(..., ge=0)
    closing_notes: Optional[str] = None
    reconciliations: Optional[list[PaymentMethodReconciliation]] = None

class CashRegisterResponse(CashRegisterBase):
    id: int
    gym_id: int
    opened_by: int
    closed_by: Optional[int] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    expected_balance: Optional[Decimal] = None
    counted_balance: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    status: str
    closing_notes: Optional[str] = None
    reconciliation_data: Optional[str] = None

    class Config:
        from_attributes = True

class CashMovementBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    type: str = Field(..., pattern="^(IN|OUT)$")
    category: str = Field(...)
    description: Optional[str] = None

class CashMovementCreate(CashMovementBase):
    pass

class CashMovementResponse(CashMovementBase):
    id: int
    gym_id: int
    cash_register_id: int
    payment_id: Optional[int] = None
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True
