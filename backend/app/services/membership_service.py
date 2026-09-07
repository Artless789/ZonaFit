from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.not_found_exception import NotFoundException
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.user import User
from app.schemas.membership import (
    MembershipCreate,
    MembershipUpdate,
)
from app.constants.membership_status import MembershipStatus
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


def ensure_utc(dt: datetime) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class MembershipService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        membership_data: MembershipCreate,
        background_tasks: "fastapi.BackgroundTasks" = None,
    ):
        import fastapi

        if not current_user.gym_id:
            raise ValueError("User is not associated with a gym.")

        client = (
            db.query(Client)
            .filter(
                Client.id == membership_data.client_id,
                Client.gym_id == current_user.gym_id,
                Client.is_active == True,
            )
            .first()
        )

        if not client:
            raise NotFoundException("Client not found.")

        plan = (
            db.query(MembershipPlan)
            .filter(
                MembershipPlan.id == membership_data.membership_plan_id,
                MembershipPlan.gym_id == current_user.gym_id,
                MembershipPlan.is_active == True,
            )
            .first()
        )

        if not plan:
            raise NotFoundException("Membership plan not found.")

        if plan.duration_days <= 0:
            raise ValueError("Plan duration must be greater than 0 days.")

        now = datetime.now(timezone.utc)

        # 1. Calculate start_date and end_date
        if membership_data.start_date is not None:
            start_date = ensure_utc(membership_data.start_date)
        else:
            # Check if client has an existing active membership for seamless renewal extension
            existing_active = (
                db.query(Membership)
                .filter(
                    Membership.client_id == client.id,
                    Membership.gym_id == current_user.gym_id,
                    Membership.is_active == True,
                    Membership.status == MembershipStatus.ACTIVE,
                )
                .order_by(Membership.end_date.desc())
                .first()
            )

            if existing_active and ensure_utc(existing_active.end_date) > now:
                # Renewal: start when current active membership finishes
                start_date = existing_active.end_date
            else:
                start_date = now

        end_date = start_date + timedelta(
            days=plan.duration_days
        )

        # 2. Validate Payment data if requested
        from decimal import Decimal
        from app.models.payment import Payment
        from app.models.sale import Sale
        from app.models.accounts_receivable import AccountsReceivable
        from app.constants.payment_status import PaymentStatus
        from app.constants.sale_status import SaleStatus
        from app.services.cash_register_service import CashRegisterService

        total_price = Decimal(str(plan.price))
        paid_amount = Decimal("0.00")
        payment_record = None

        if membership_data.register_payment and membership_data.amount_paid is not None:
            paid_amount = Decimal(str(membership_data.amount_paid))
            if paid_amount < Decimal("0.00"):
                raise ValueError("El monto a pagar no puede ser negativo.")
            if paid_amount > total_price:
                raise ValueError(
                    f"El monto a pagar ({paid_amount}) no puede superar el total de la membresía ({total_price})."
                )
            if paid_amount > Decimal("0.00") and not membership_data.payment_method:
                raise ValueError("Debe especificar un método de pago para registrar el pago.")

        # Check cash register if CASH
        active_register = None
        if paid_amount > Decimal("0.00") and membership_data.payment_method and membership_data.payment_method.upper() == "CASH":
            active_register = CashRegisterService.get_active(db, current_user.gym_id)
            if not active_register:
                raise ValueError("No se puede registrar pago de membresía en efectivo sin una caja abierta.")

        pending_balance = total_price - paid_amount

        membership = Membership(
            gym_id=current_user.gym_id,
            client_id=client.id,
            membership_plan_id=plan.id,
            start_date=start_date,
            end_date=end_date,
            price=plan.price,
            status=MembershipStatus.ACTIVE,
            trainer_name=membership_data.trainer_name,
        )

        with DatabaseTransaction(db):
            db.add(membership)
            db.flush()

            # 3. Create Payment & Cash Movement if amount > 0
            if paid_amount > Decimal("0.00"):
                payment_record = Payment(
                    gym_id=current_user.gym_id,
                    membership_id=membership.id,
                    amount=paid_amount,
                    payment_method=membership_data.payment_method.upper(),
                    reference=membership_data.reference,
                    status=PaymentStatus.PAID,
                )
                db.add(payment_record)
                db.flush()

                if active_register:
                    CashRegisterService.add_movement(
                        db=db,
                        current_user=current_user,
                        register=active_register,
                        amount=paid_amount,
                        type="IN",
                        category="MEMBERSHIP_PAYMENT",
                        description=f"Pago membresía #{membership.id}",
                        payment_id=payment_record.id,
                    )

            # 4. If pending balance > 0, register AccountsReceivable and associated Sale
            if pending_balance > Decimal("0.00"):
                sale = Sale(
                    gym_id=current_user.gym_id,
                    client_id=client.id,
                    total=total_price,
                    status=SaleStatus.COMPLETED,
                    notes=f"Membresía #{membership.id} - {plan.name}",
                )
                db.add(sale)
                db.flush()

                ar_status = "PENDING" if paid_amount == Decimal("0.00") else "PARTIAL"
                accounts_receivable = AccountsReceivable(
                    gym_id=current_user.gym_id,
                    client_id=client.id,
                    sale_id=sale.id,
                    original_amount=total_price,
                    paid_amount=paid_amount,
                    balance_due=pending_balance,
                    due_date=end_date,
                    status=ar_status,
                )
                db.add(accounts_receivable)
                db.flush()

            db.refresh(membership)

        # --- NOTIFICATION HOOK: MEMBERSHIP_SOLD & PAYMENT_RECEIVED ---
        try:
            from app.models.gym_settings import GymSettings
            from app.services.notification_service import NotificationService
            
            gym_settings = db.query(GymSettings).filter(GymSettings.gym_id == current_user.gym_id).first()
            
            if client and client.phone:
                context = {
                    "client_name": client.full_name,
                    "gym_name": gym_settings.trade_name if gym_settings else "ZonaFit Gym",
                    "membership_name": plan.name,
                    "plan_name": plan.name,
                    "amount": str(paid_amount if paid_amount > 0 else plan.price),
                    "balance_due": str(pending_balance),
                    "payment_method": membership_data.payment_method or "N/A",
                    "expiry_date": end_date.strftime("%Y-%m-%d"),
                }
                
                event_type = "PAYMENT_RECEIVED" if paid_amount > 0 else "MEMBERSHIP_SOLD"
                notif = NotificationService.dispatch_from_template(
                    db=db,
                    gym_id=current_user.gym_id,
                    event_type=event_type,
                    channel="WHATSAPP",
                    recipient=client.phone,
                    context=context,
                    client_id=client.id,
                )
                if notif and background_tasks:
                    background_tasks.add_task(
                        NotificationService.send_and_update,
                        notification_id=notif.id,
                    )
        except Exception:
            pass

        membership.total_paid = float(paid_amount)
        membership.pending_balance = float(pending_balance)
        membership.payments = [payment_record] if payment_record else []

        return membership

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):
        if not current_user.gym_id:
            raise ValueError("User is not associated with a gym.")

        query = (
            db.query(Membership)
            .options(
                joinedload(Membership.client),
                joinedload(Membership.membership_plan),
            )
            .filter(
                Membership.gym_id == current_user.gym_id,
                Membership.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Membership.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "start_date": Membership.start_date,
                "end_date": Membership.end_date,
                "status": Membership.status,
                "created_at": Membership.created_at,
            },
        )

        result = paginate(
            query=query,
            params=params,
        )

        # Synchronize dynamic status for display if end_date has passed and calculate balances
        from app.models.sale import Sale
        from app.models.accounts_receivable import AccountsReceivable
        from app.models.payment import Payment

        now = datetime.now(timezone.utc)
        for item in result.items:
            if item.status == MembershipStatus.ACTIVE and ensure_utc(item.end_date) < now:
                item.status = MembershipStatus.EXPIRED
            
            active_payments = [
                p for p in (item.payments or [])
                if getattr(p, "is_active", True) and p.gym_id == current_user.gym_id
            ]

            # Also check if there are AR payments for this membership's sale
            linked_sales = (
                db.query(Sale)
                .filter(
                    Sale.gym_id == current_user.gym_id,
                    Sale.client_id == item.client_id,
                    Sale.notes.like(f"Membresía #{item.id}%")
                )
                .all()
            )
            for s in linked_sales:
                if s.accounts_receivable:
                    ar_payments = (
                        db.query(Payment)
                        .filter(
                            Payment.accounts_receivable_id == s.accounts_receivable.id,
                            Payment.is_active == True,
                            Payment.gym_id == current_user.gym_id
                        )
                        .all()
                    )
                    for ap in ar_payments:
                        if ap not in active_payments:
                            active_payments.append(ap)

            item.payments = active_payments
            total_paid = sum(float(p.amount) for p in active_payments)
            item.total_paid = total_paid
            item.pending_balance = max(0.0, float(item.price) - total_paid)

        return result

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        membership_id: int,
    ):
        if not current_user.gym_id:
            return None

        membership = (
            db.query(Membership)
            .options(
                joinedload(Membership.client),
                joinedload(Membership.membership_plan),
            )
            .filter(
                Membership.id == membership_id,
                Membership.gym_id == current_user.gym_id,
            )
            .first()
        )

        if membership:
            now = datetime.now(timezone.utc)
            if membership.status == MembershipStatus.ACTIVE and ensure_utc(membership.end_date) < now:
                membership.status = MembershipStatus.EXPIRED

            active_payments = [
                p for p in (membership.payments or [])
                if getattr(p, "is_active", True) and p.gym_id == current_user.gym_id
            ]

            # Also check if there are AR payments for this membership's sale
            from app.models.sale import Sale
            from app.models.accounts_receivable import AccountsReceivable
            from app.models.payment import Payment

            linked_sales = (
                db.query(Sale)
                .filter(
                    Sale.gym_id == current_user.gym_id,
                    Sale.client_id == membership.client_id,
                    Sale.notes.like(f"Membresía #{membership.id}%")
                )
                .all()
            )
            for s in linked_sales:
                if s.accounts_receivable:
                    ar_payments = (
                        db.query(Payment)
                        .filter(
                            Payment.accounts_receivable_id == s.accounts_receivable.id,
                            Payment.is_active == True,
                            Payment.gym_id == current_user.gym_id
                        )
                        .all()
                    )
                    for ap in ar_payments:
                        if ap not in active_payments:
                            active_payments.append(ap)

            membership.payments = active_payments
            total_paid = sum(float(p.amount) for p in active_payments)
            membership.total_paid = total_paid
            membership.pending_balance = max(0.0, float(membership.price) - total_paid)

        return membership

    @staticmethod
    def update(
        db: Session,
        membership: Membership,
        membership_data: MembershipUpdate,
    ):
        update_data = membership_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(membership, key, value)
            db.flush()
            db.refresh(membership)

        return membership

    @staticmethod
    def delete(
        db: Session,
        membership: Membership,
    ):
        with DatabaseTransaction(db):
            membership.is_active = False