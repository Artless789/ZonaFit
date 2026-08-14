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
    client_name: str
    plan_name: str
    end_date: datetime
    days_left: int

class DashboardReceivable(BaseModel):
    id: int
    client_name: str
    balance_due: Decimal
    due_date: Optional[datetime] = None
    days_overdue: int

class DashboardResponse(BaseModel):
    # KPI Superiores
    sales_today: int
    sales_today_amount: Decimal
    income_this_month: Decimal
    active_clients: int
    expiring_memberships_count: int # in next 7 days
    total_receivables: Decimal
    overdue_receivables: Decimal

    # Actividad de hoy
    recent_activity: List[DashboardActivity]

    # Membresías por vencer
    expiring_memberships: List[DashboardExpiringMembership]

    # Cartera pendiente
    receivables: List[DashboardReceivable]