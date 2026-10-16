from decimal import Decimal
from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel

class DashboardActivity(BaseModel):
    id: str
    type: str # 'SALE', 'MEMBERSHIP', 'CLIENT', 'PAYMENT'
    title: str
    subtitle: str
    amount: Optional[Decimal] = None
    created_at: datetime

class DashboardExpiringMembership(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: str
    client_phone: Optional[str] = None
    price: Optional[Decimal] = None
    plan_id: Optional[int] = None
    client_photo_url: Optional[str] = None
    client_document: Optional[str] = None
    plan_name: str
    end_date: datetime
    days_left: int

class DashboardReceivable(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: str
    client_phone: Optional[str] = None
    balance_due: Decimal
    due_date: Optional[datetime] = None
    days_overdue: int

class DailyIncome(BaseModel):
    date: str
    day: int
    amount: Decimal
    transaction_count: int
    membership_amount: Decimal = Decimal("0.00")
    pos_amount: Decimal = Decimal("0.00")
    receivable_amount: Decimal = Decimal("0.00")
    day_label: Optional[str] = None

class DashboardResponse(BaseModel):
    # KPI Superiores
    sales_today: int
    sales_today_amount: Decimal
    collected_today_amount: Decimal = Decimal("0.00")
    credit_today_amount: Decimal = Decimal("0.00")
    income_this_month: Decimal
    active_clients: int
    active_membership_clients: int = 0
    expiring_memberships_count: int # in next 7 days
    total_receivables: Decimal
    overdue_receivables: Decimal

    # Actividad de hoy
    recent_activity: List[DashboardActivity]

    # Membresías por vencer
    expiring_memberships: List[DashboardExpiringMembership]

    # Cartera pendiente
    receivables: List[DashboardReceivable]

    # Tendencia de ingresos
    daily_revenue_trend: List[DailyIncome] = []

class ConceptIncome(BaseModel):
    concept: str
    label: str
    amount: Decimal
    percentage: float
    transaction_count: int

class MethodIncome(BaseModel):
    method: str
    label: str
    amount: Decimal
    percentage: float
    transaction_count: int

class RecentPaymentItem(BaseModel):
    id: int
    amount: Decimal
    payment_method: str
    payment_method_label: str
    concept: str
    concept_description: str
    client_name: Optional[str] = None
    created_at: datetime
    day: int

class IncomeDetailsResponse(BaseModel):
    month_name: str
    month: int
    year: int
    total_income: Decimal
    total_transactions: int
    average_ticket: Decimal
    highest_day: Optional[DailyIncome] = None
    by_concept: List[ConceptIncome]
    by_method: List[MethodIncome]
    daily_history: List[DailyIncome]
    recent_payments: List[RecentPaymentItem]