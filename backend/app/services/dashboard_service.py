import calendar
from decimal import Decimal
from datetime import datetime, timedelta, timezone, time
from typing import Optional
from sqlalchemy import func, or_
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
    DashboardReceivable,
    IncomeDetailsResponse,
    DailyIncome,
    ConceptIncome,
    MethodIncome,
    RecentPaymentItem,
)


class DashboardService:

    @staticmethod
    def _get_gym_timezone(db: Session, gym_id: Optional[int]) -> timezone:
        if not gym_id:
            return timezone(timedelta(hours=-5))
        try:
            from app.models.gym_settings import GymSettings
            settings = db.query(GymSettings).filter(GymSettings.gym_id == gym_id).first()
            tz_str = settings.timezone if settings and settings.timezone else "America/Bogota"
            from zoneinfo import ZoneInfo
            return ZoneInfo(tz_str)
        except Exception:
            return timezone(timedelta(hours=-5))

    @staticmethod
    def get_dashboard(
        db: Session,
        current_user: User,
    ) -> DashboardResponse:
        
        gym_tz = DashboardService._get_gym_timezone(db, current_user.gym_id)
        now_local = datetime.now(gym_tz)
        today_start = datetime.combine(now_local.date(), time.min, tzinfo=gym_tz)
        month_start = datetime.combine(now_local.date().replace(day=1), time.min, tzinfo=gym_tz)
        next_week = today_start + timedelta(days=7)

        # 1. Ventas del día (Ventas POS + Membresías nuevas/renovadas creadas hoy)
        pos_sales_query = db.query(Sale).filter(
            Sale.gym_id == current_user.gym_id,
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_active == True,
            Sale.created_at >= today_start,
            or_(Sale.notes.is_(None), ~Sale.notes.like("Membresía #%"))  # Excluir ventas shadow internas de membresías
        )
        pos_sales_count = pos_sales_query.count()
        pos_sales_amount = db.query(func.sum(Sale.total)).filter(
            Sale.gym_id == current_user.gym_id,
            Sale.status == SaleStatus.COMPLETED,
            Sale.is_active == True,
            Sale.created_at >= today_start,
            or_(Sale.notes.is_(None), ~Sale.notes.like("Membresía #%"))
        ).scalar() or Decimal("0.00")

        memberships_today_query = db.query(Membership).filter(
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True,
            Membership.created_at >= today_start
        )
        memberships_today_count = memberships_today_query.count()
        memberships_today_amount = db.query(func.sum(Membership.price)).filter(
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True,
            Membership.created_at >= today_start
        ).scalar() or Decimal("0.00")

        sales_today = pos_sales_count + memberships_today_count
        sales_today_amount = pos_sales_amount + memberships_today_amount

        # 2. Ingresos del mes (Payments reales efectivamente cobrados)
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

        # 4. Total por cobrar y vencidos (Cubre PENDING y PARTIAL con balance_due > 0)
        total_receivables = db.query(func.sum(AccountsReceivable.balance_due)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.balance_due > Decimal("0.00"),
            AccountsReceivable.is_active == True
        ).scalar() or Decimal("0.00")

        overdue_receivables = db.query(func.sum(AccountsReceivable.balance_due)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.balance_due > Decimal("0.00"),
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
            days_left = 0
            if m.end_date:
                if isinstance(m.end_date, datetime):
                    end_local = m.end_date.astimezone(gym_tz) if m.end_date.tzinfo else m.end_date.replace(tzinfo=timezone.utc).astimezone(gym_tz)
                    days_left = (end_local.date() - now_local.date()).days
                else:
                    days_left = (m.end_date - now_local.date()).days
            if days_left < 0: days_left = 0
            expiring_memberships.append(DashboardExpiringMembership(
                id=m.id,
                client_name=m.client.full_name if m.client else "Desconocido",
                plan_name=m.membership_plan.name if m.membership_plan else "Desconocido",
                end_date=m.end_date,
                days_left=days_left
            ))

        # 6. Cartera pendiente (Lista con saldo adeudado > 0)
        receivables_db = db.query(AccountsReceivable).options(joinedload(AccountsReceivable.client)).filter(
            AccountsReceivable.gym_id == current_user.gym_id,
            AccountsReceivable.balance_due > Decimal("0.00"),
            AccountsReceivable.is_active == True
        ).order_by(AccountsReceivable.balance_due.desc()).limit(10).all()

        receivables = []
        for r in receivables_db:
            days_overdue = 0
            if r.due_date:
                if isinstance(r.due_date, datetime):
                    due_local = r.due_date.astimezone(gym_tz) if r.due_date.tzinfo else r.due_date.replace(tzinfo=timezone.utc).astimezone(gym_tz)
                    if due_local.date() < now_local.date():
                        days_overdue = (now_local.date() - due_local.date()).days
                else:
                    if r.due_date < now_local.date():
                        days_overdue = (now_local.date() - r.due_date).days
                
            receivables.append(DashboardReceivable(
                id=r.id,
                client_name=r.client.full_name if r.client else "Desconocido",
                balance_due=r.balance_due,
                due_date=r.due_date,
                days_overdue=days_overdue
            ))

        # 7. Actividad de Hoy (Línea de tiempo de operaciones)
        recent_activity = []
        
        # Sales today (POS no-shadow)
        today_sales = pos_sales_query.options(joinedload(Sale.client)).order_by(Sale.created_at.desc()).limit(10).all()
        for s in today_sales:
            recent_activity.append(DashboardActivity(
                id=f"sale_{s.id}",
                type="SALE",
                title="Nueva Venta POS",
                subtitle=f"Cliente: {s.client.full_name if s.client else 'De Contado'}",
                amount=s.total,
                created_at=s.created_at
            ))
            
        # Memberships today
        today_memberships = db.query(Membership).options(
            joinedload(Membership.client),
            joinedload(Membership.membership_plan)
        ).filter(
            Membership.gym_id == current_user.gym_id,
            Membership.created_at >= today_start
        ).order_by(Membership.created_at.desc()).limit(10).all()
        for m in today_memberships:
            plan_title = m.membership_plan.name if m.membership_plan else "Membresía"
            client_name = m.client.full_name if m.client else "Cliente"
            recent_activity.append(DashboardActivity(
                id=f"mem_{m.id}",
                type="MEMBERSHIP",
                title="Nueva Membresía",
                subtitle=f"{client_name} - {plan_title}",
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
            context = "Pago recibido"
            if p.sale_id: context = f"Pago Venta POS #{p.sale_id}"
            if p.membership_id: context = f"Pago Membresía #{p.membership_id}"
            if p.accounts_receivable_id: context = f"Abono a Crédito #{p.accounts_receivable_id}"
            recent_activity.append(DashboardActivity(
                id=f"pay_{p.id}",
                type="PAYMENT",
                title="Pago Recibido",
                subtitle=f"{context} ({p.payment_method})",
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

    @staticmethod
    def get_income_details(
        db: Session,
        current_user: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> IncomeDetailsResponse:
        gym_tz = DashboardService._get_gym_timezone(db, current_user.gym_id)
        now_local = datetime.now(gym_tz)
        target_year = year if (year is not None and 2000 <= year <= 2100) else now_local.year
        target_month = month if (month is not None and 1 <= month <= 12) else now_local.month

        num_days = calendar.monthrange(target_year, target_month)[1]
        month_start = datetime(target_year, target_month, 1, 0, 0, 0, tzinfo=gym_tz)
        month_end = datetime(target_year, target_month, num_days, 23, 59, 59, 999999, tzinfo=gym_tz)
        
        # Query all active PAID payments for this gym in this month
        payments = (
            db.query(Payment)
            .options(
                joinedload(Payment.membership).joinedload(Membership.client),
                joinedload(Payment.membership).joinedload(Membership.membership_plan),
                joinedload(Payment.sale).joinedload(Sale.client),
                joinedload(Payment.accounts_receivable).joinedload(AccountsReceivable.client),
            )
            .filter(
                Payment.gym_id == current_user.gym_id,
                Payment.status == "PAID",
                Payment.is_active == True,
                Payment.created_at >= month_start,
                Payment.created_at <= month_end,
            )
            .order_by(Payment.created_at.desc())
            .all()
        )

        total_income = sum((p.amount for p in payments), Decimal("0.00"))
        total_transactions = len(payments)
        average_ticket = (total_income / total_transactions) if total_transactions > 0 else Decimal("0.00")

        month_names = {
            1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
            5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
            9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
        }
        month_name = f"{month_names.get(target_month, '')} {target_year}"

        concept_map = {
            "MEMBERSHIP": {"label": "Membresías", "amount": Decimal("0.00"), "count": 0},
            "SALE": {"label": "Ventas Tienda (POS)", "amount": Decimal("0.00"), "count": 0},
            "RECEIVABLE": {"label": "Abonos a Cartera", "amount": Decimal("0.00"), "count": 0},
        }

        method_labels = {
            "CASH": "Efectivo",
            "TRANSFER": "Transferencia Bancaria",
            "CARD": "Tarjeta Débito/Crédito",
            "OTHER": "Otro Medio",
        }
        method_map = {}

        daily_map = {}
        for d in range(1, num_days + 1):
            date_str = f"{target_year}-{target_month:02d}-{d:02d}"
            daily_map[d] = {"date": date_str, "day": d, "amount": Decimal("0.00"), "count": 0}

        recent_payments = []

        for p in payments:
            amt = p.amount or Decimal("0.00")
            
            c_key = "MEMBERSHIP" if p.membership_id else ("SALE" if p.sale_id else "RECEIVABLE")
            concept_map[c_key]["amount"] += amt
            concept_map[c_key]["count"] += 1

            m_code = (p.payment_method or "OTHER").upper()
            m_label = method_labels.get(m_code, m_code)
            if m_code not in method_map:
                method_map[m_code] = {"label": m_label, "amount": Decimal("0.00"), "count": 0}
            method_map[m_code]["amount"] += amt
            method_map[m_code]["count"] += 1

            created_at_local = p.created_at.astimezone(gym_tz) if (p.created_at and p.created_at.tzinfo) else (
                p.created_at.replace(tzinfo=timezone.utc).astimezone(gym_tz) if p.created_at else now_local
            )
            p_day = created_at_local.day
            if p_day in daily_map:
                daily_map[p_day]["amount"] += amt
                daily_map[p_day]["count"] += 1
            else:
                date_str = created_at_local.strftime("%Y-%m-%d")
                daily_map[p_day] = {"date": date_str, "day": p_day, "amount": amt, "count": 1}

            client_name = None
            concept_desc = ""
            if p.membership:
                client_name = p.membership.client.full_name if p.membership.client else None
                concept_desc = f"Membresía: {p.membership.membership_plan.name}" if p.membership.membership_plan else "Membresía"
            elif p.sale:
                client_name = p.sale.client.full_name if p.sale.client else "Cliente Mostrador"
                concept_desc = f"Venta POS #{p.sale.id}"
            elif p.accounts_receivable:
                client_name = p.accounts_receivable.client.full_name if p.accounts_receivable.client else None
                concept_desc = f"Abono a Cartera #{p.accounts_receivable_id}"

            recent_payments.append(RecentPaymentItem(
                id=p.id,
                amount=amt,
                payment_method=m_code,
                payment_method_label=m_label,
                concept=c_key,
                concept_description=concept_desc,
                client_name=client_name,
                created_at=p.created_at or now_local,
                day=p_day,
            ))

        by_concept = []
        for k, v in concept_map.items():
            pct = float((v["amount"] / total_income) * 100) if total_income > 0 else 0.0
            by_concept.append(ConceptIncome(
                concept=k,
                label=v["label"],
                amount=v["amount"],
                percentage=round(pct, 1),
                transaction_count=v["count"],
            ))

        by_method = []
        for k, v in method_map.items():
            pct = float((v["amount"] / total_income) * 100) if total_income > 0 else 0.0
            by_method.append(MethodIncome(
                method=k,
                label=v["label"],
                amount=v["amount"],
                percentage=round(pct, 1),
                transaction_count=v["count"],
            ))
        by_method.sort(key=lambda x: x.amount, reverse=True)

        daily_history = []
        for d in sorted(daily_map.keys()):
            v = daily_map[d]
            daily_history.append(DailyIncome(
                date=v["date"],
                day=v["day"],
                amount=v["amount"],
                transaction_count=v["count"],
            ))

        highest_day = None
        if daily_history:
            days_with_income = [d for d in daily_history if d.amount > 0]
            if days_with_income:
                highest_day = max(days_with_income, key=lambda x: x.amount)

        return IncomeDetailsResponse(
            month_name=month_name,
            month=target_month,
            year=target_year,
            total_income=total_income,
            total_transactions=total_transactions,
            average_ticket=round(average_ticket, 2),
            highest_day=highest_day,
            by_concept=by_concept,
            by_method=by_method,
            daily_history=daily_history,
            recent_payments=recent_payments[:100],
        )