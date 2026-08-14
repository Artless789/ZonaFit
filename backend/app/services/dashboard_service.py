from decimal import Decimal
from datetime import datetime, timedelta, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.constants.membership_status import MembershipStatus
from app.constants.sale_status import SaleStatus
from app.models.client import Client
from app.models.membership import Membership
from app.models.sale import Sale
from app.models.payment import Payment
from app.models.accounts_receivable import AccountsReceivable
from app.models.user import User
from app.schemas.dashboard import (
    DashboardResponse,
    DashboardActivity,
    DashboardExpiringMembership,
    DashboardReceivable
)


class DashboardService:

    @staticmethod
    def get_dashboard(
        db: Session,
        current_user: User,
    ) -> DashboardResponse:
        
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        month_start = today_start.replace(day=1)
        next_week = today_start + timedelta(days=7)

        # 1. Ventas del día
        sales_today_query = db.query(Sale).filter(
            Sale.gym_id == current_user.gym_id,
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_active == True,
            Sale.created_at >= today_start
        )
        sales_today = sales_today_query.count()
        sales_today_amount = db.query(func.sum(Sale.total)).filter(
            Sale.gym_id == current_user.gym_id,
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_active == True,
            Sale.created_at >= today_start
        ).scalar() or Decimal("0.00")

        # 2. Ingresos del mes (Payments reales)
        income_this_month = db.query(func.sum(Payment.amount)).filter(
            Payment.gym_id == current_user.gym_id,
            Payment.status == "PAID",
            Payment.is_active == True,
            Payment.created_at >= month_start
        ).scalar() or Decimal("0.00")

        # 3. Clientes activos
        active_clients = db.query(Client).filter(
            Client.gym_id == current_user.gym_id,
            Client.is_active == True
        ).count()

        # 4. Total por cobrar y vencidos
        total_receivables = db.query(func.sum(AccountsReceivable.balance_due)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.status == "PENDING",
            AccountsReceivable.is_active == True
        ).scalar() or Decimal("0.00")

        overdue_receivables = db.query(func.sum(AccountsReceivable.balance_due)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.status == "PENDING",
            AccountsReceivable.is_active == True,
            AccountsReceivable.due_date < today_start
        ).scalar() or Decimal("0.00")

        # 5. Membresías por vencer (próximos 7 días)
        expiring_memberships_query = db.query(Membership).options(
            joinedload(Membership.client),
            joinedload(Membership.membership_plan)
        ).filter(
            Membership.gym_id == current_user.gym_id,
            Membership.status == MembershipStatus.ACTIVE,
            Membership.is_active == True,
            Membership.end_date >= today_start,
            Membership.end_date <= next_week
        ).order_by(Membership.end_date.asc())
        
        expiring_memberships_count = expiring_memberships_query.count()
        
        # Limitar para la lista
        expiring_memberships_db = expiring_memberships_query.limit(10).all()
        expiring_memberships = []
        for m in expiring_memberships_db:
            days_left = (m.end_date.replace(tzinfo=timezone.utc) - now).days
            if days_left < 0: days_left = 0
            expiring_memberships.append(DashboardExpiringMembership(
                id=m.id,
                client_name=m.client.full_name if m.client else "Desconocido",
                plan_name=m.membership_plan.name if m.membership_plan else "Desconocido",
                end_date=m.end_date,
                days_left=days_left
            ))

        # 6. Cartera pendiente (Lista)
        receivables_db = db.query(AccountsReceivable).options(joinedload(AccountsReceivable.client)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.status == "PENDING",
            AccountsReceivable.is_active == True
        ).order_by(AccountsReceivable.balance_due.desc()).limit(10).all()

        receivables = []
        for r in receivables_db:
            days_overdue = 0
            if r.due_date and r.due_date.replace(tzinfo=timezone.utc) < today_start:
                days_overdue = (now - r.due_date.replace(tzinfo=timezone.utc)).days
                
            receivables.append(DashboardReceivable(
                id=r.id,
                client_name=r.client.full_name if r.client else "Desconocido",
                balance_due=r.balance_due,
                due_date=r.due_date,
                days_overdue=days_overdue
            ))

        # 7. Actividad de Hoy
        recent_activity = []
        
        # Sales today
        today_sales = sales_today_query.options(joinedload(Sale.client)).order_by(Sale.created_at.desc()).limit(10).all()
        for s in today_sales:
            recent_activity.append(DashboardActivity(
                id=f"sale_{s.id}",
                type="SALE",
                title="Nueva Venta",
                subtitle=f"Cliente: {s.client.full_name if s.client else 'De Contado'}",
                amount=s.total,
                created_at=s.created_at
            ))
            
        # Memberships today
        today_memberships = db.query(Membership).options(joinedload(Membership.client)).filter(
            Membership.gym_id == current_user.gym_id,
            Membership.created_at >= today_start
        ).order_by(Membership.created_at.desc()).limit(10).all()
        for m in today_memberships:
            recent_activity.append(DashboardActivity(
                id=f"mem_{m.id}",
                type="MEMBERSHIP",
                title="Nueva Membresía",
                subtitle=m.client.full_name if m.client else "Desconocido",
                amount=m.price,
                created_at=m.created_at
            ))

        # Clients today
        today_clients = db.query(Client).filter(
            Client.gym_id == current_user.gym_id,
            Client.created_at >= today_start
        ).order_by(Client.created_at.desc()).limit(10).all()
        for c in today_clients:
            recent_activity.append(DashboardActivity(
                id=f"cli_{c.id}",
                type="CLIENT",
                title="Nuevo Cliente",
                subtitle=c.full_name,
                amount=None,
                created_at=c.created_at
            ))

        # Payments today
        today_payments = db.query(Payment).filter(
            Payment.gym_id == current_user.gym_id,
            Payment.created_at >= today_start
        ).order_by(Payment.created_at.desc()).limit(10).all()
        for p in today_payments:
            context = "Pago general"
            if p.sale_id: context = f"Pago Venta #{p.sale_id}"
            if p.membership_id: context = f"Pago Membresía"
            if p.accounts_receivable_id: context = f"Abono de Crédito"
            recent_activity.append(DashboardActivity(
                id=f"pay_{p.id}",
                type="PAYMENT",
                title="Ingreso Registrado",
                subtitle=context,
                amount=p.amount,
                created_at=p.created_at
            ))
            
        # Sort combined activity by created_at desc
        recent_activity.sort(key=lambda x: x.created_at, reverse=True)
        # Limit to 15 items total
        recent_activity = recent_activity[:15]

        return DashboardResponse(
            sales_today=sales_today,
            sales_today_amount=sales_today_amount,
            income_this_month=income_this_month,
            active_clients=active_clients,
            expiring_memberships_count=expiring_memberships_count,
            total_receivables=total_receivables,
            overdue_receivables=overdue_receivables,
            recent_activity=recent_activity,
            expiring_memberships=expiring_memberships,
            receivables=receivables
        )