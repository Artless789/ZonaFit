from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.not_found_exception import NotFoundException
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate,
    PaymentUpdate,
)
from app.constants.payment_status import PaymentStatus
from app.constants.payment_methods import PaymentMethod
from app.services.cash_register_service import CashRegisterService
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort

class PaymentService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        payment_data: PaymentCreate,
        background_tasks: "fastapi.BackgroundTasks" = None,
    ):
        import fastapi

        membership = (
            db.query(Membership)
            .filter(
                Membership.id == payment_data.membership_id,
                Membership.gym_id == current_user.gym_id,
                Membership.is_active == True,
            )
            .first()
        )

        if not membership:
            raise NotFoundException("Membership not found.")

        # Calculate already paid amount
        already_paid = (
            db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
            .filter(
                Payment.membership_id == membership.id,
                Payment.gym_id == current_user.gym_id,
                Payment.status == PaymentStatus.PAID,
                Payment.is_active == True,
            )
            .scalar()
        ) or Decimal("0.00")

        remaining_balance = membership.price - Decimal(str(already_paid))

        if payment_data.amount is not None:
            pay_amount = Decimal(str(payment_data.amount))
        else:
            pay_amount = remaining_balance

        if pay_amount <= Decimal("0.00"):
            raise ValueError("El monto a pagar debe ser mayor a cero.")

        if pay_amount > remaining_balance:
            raise ValueError(
                f"El monto a pagar ({pay_amount}) no puede superar el saldo pendiente ({remaining_balance})."
            )

        # Verify Cash Register if payment is CASH
        active_register = None
        if payment_data.payment_method.upper() == "CASH":
            active_register = CashRegisterService.get_active(db, current_user.gym_id)
            if not active_register:
                raise ValueError("No se puede registrar pago de membresía en efectivo sin una caja abierta.")

        payment = Payment(
            gym_id=current_user.gym_id,
            membership_id=membership.id,
            amount=pay_amount,
            payment_method=payment_data.payment_method,
            reference=payment_data.reference,
            status=PaymentStatus.PAID,
        )

        with DatabaseTransaction(db):
            db.add(payment)
            db.flush()

            if active_register:
                CashRegisterService.add_movement(
                    db=db,
                    current_user=current_user,
                    register=active_register,
                    amount=pay_amount,
                    type="IN",
                    category="MEMBERSHIP_PAYMENT",
                    description=f"Pago membresía #{membership.id}",
                    payment_id=payment.id
                )

            db.refresh(payment)

        # --- NOTIFICATION HOOK: PAYMENT_RECEIVED ---
        try:
            from app.models.client import Client
            from app.models.gym_settings import GymSettings
            from app.services.notification_service import NotificationService
            
            client = db.query(Client).filter(Client.id == membership.client_id).first()
            gym_settings = db.query(GymSettings).filter(GymSettings.gym_id == current_user.gym_id).first()
            
            if client and client.phone:
                context = {
                    "client_name": client.full_name,
                    "gym_name": gym_settings.trade_name if gym_settings else "ZonaFit Gym",
                    "amount": str(payment.amount),
                }
                
                # Check for idempotency: avoid sending duplicate notifications for the same payment reference
                from app.models.notification import Notification
                existing_notif = db.query(Notification).filter(
                    Notification.gym_id == current_user.gym_id,
                    Notification.client_id == client.id,
                    Notification.event_type == "PAYMENT_RECEIVED",
                    Notification.message_body.like(f"%{payment.amount}%")  # Basic idempotency check for this event
                ).first()
                
                if not existing_notif:
                    notif = NotificationService.dispatch_from_template(
                        db=db,
                        gym_id=current_user.gym_id,
                        event_type="PAYMENT_RECEIVED",
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
        except Exception as e:
            # Silently ignore notification errors so payment creation isn't blocked
            pass

        return payment

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Payment)
            .filter(
                Payment.gym_id == current_user.gym_id,
                Payment.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Payment.payment_method,
                Payment.reference,
                Payment.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "amount": Payment.amount,
                "payment_method": Payment.payment_method,
                "status": Payment.status,
                "created_at": Payment.created_at,
            },
        )

        return paginate(
            query=query,
            params=params,
        )

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        payment_id: int,
    ):
        return (
            db.query(Payment)
            .filter(
                Payment.id == payment_id,
                Payment.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        payment: Payment,
        payment_data: PaymentUpdate,
    ):
        update_data = payment_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(payment, key, value)
            db.flush()
            db.refresh(payment)

        return payment

    @staticmethod
    def delete(
        db: Session,
        payment: Payment,
    ):
        with DatabaseTransaction(db):
            payment.is_active = False