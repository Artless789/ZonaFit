import json
from decimal import Decimal
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.not_found_exception import NotFoundException
from app.models.accounts_receivable import AccountsReceivable
from app.models.audit_log import AuditLog
from app.models.cash_movement import CashMovement
from app.models.cash_register import CashRegister
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.sale import Sale
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
    def find_membership_receivable(
        db: Session,
        gym_id: int,
        membership_id: int,
    ) -> AccountsReceivable | None:
        return (
            db.query(AccountsReceivable)
            .join(Sale, AccountsReceivable.sale_id == Sale.id)
            .filter(
                AccountsReceivable.gym_id == gym_id,
                AccountsReceivable.is_active == True,
                Sale.gym_id == gym_id,
                Sale.is_active == True,
                or_(
                    Sale.notes == f"Membresía #{membership_id}",
                    Sale.notes.like(f"Membresía #{membership_id} - %"),
                ),
            )
            .first()
        )

    @staticmethod
    def reverse_payment_in_tx(
        db: Session,
        payment: Payment,
        current_user: User | None = None,
        reason: str | None = None,
    ) -> None:
        if payment.is_active and payment.status == PaymentStatus.PAID:
            orig_mov = (
                db.query(CashMovement)
                .filter(
                    CashMovement.payment_id == payment.id,
                    CashMovement.gym_id == payment.gym_id,
                    CashMovement.type == "IN",
                )
                .first()
            )
            if orig_mov:
                existing_rev = (
                    db.query(CashMovement)
                    .filter(
                        CashMovement.payment_id == payment.id,
                        CashMovement.gym_id == payment.gym_id,
                        CashMovement.type == "OUT",
                        CashMovement.category == "REVERSAL",
                    )
                    .first()
                )
                if not existing_rev:
                    target_reg = (
                        db.query(CashRegister)
                        .filter(
                            CashRegister.id == orig_mov.cash_register_id,
                            CashRegister.gym_id == payment.gym_id,
                            CashRegister.status == "OPEN",
                        )
                        .first()
                    )
                    if not target_reg:
                        target_reg = CashRegisterService.get_active(db, payment.gym_id)

                    if target_reg:
                        user_id = current_user.id if current_user else orig_mov.created_by
                        rev_mov = CashMovement(
                            gym_id=payment.gym_id,
                            cash_register_id=target_reg.id,
                            payment_id=payment.id,
                            amount=orig_mov.amount,
                            type="OUT",
                            category="REVERSAL",
                            description=reason or f"Reversión contable de pago #{payment.id}",
                            created_by=user_id,
                        )
                        db.add(rev_mov)

        payment.status = PaymentStatus.CANCELLED
        payment.is_active = False

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

        linked_ar = PaymentService.find_membership_receivable(
            db, current_user.gym_id, membership.id
        )

        # Calculate already paid amount (both direct membership payments and AR abonos)
        direct_paid = (
            db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
            .filter(
                Payment.membership_id == membership.id,
                Payment.gym_id == current_user.gym_id,
                Payment.status == PaymentStatus.PAID,
                Payment.is_active == True,
            )
            .scalar()
        ) or Decimal("0.00")

        ar_paid = Decimal("0.00")
        if linked_ar:
            ar_paid = (
                db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
                .filter(
                    Payment.accounts_receivable_id == linked_ar.id,
                    Payment.gym_id == current_user.gym_id,
                    Payment.status == PaymentStatus.PAID,
                    Payment.is_active == True,
                )
                .scalar()
            ) or Decimal("0.00")

        already_paid = Decimal(str(direct_paid)) + Decimal(str(ar_paid))
        remaining_balance = Decimal(str(membership.price)) - already_paid

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

        method_upper = payment_data.payment_method.upper().strip()

        # Verify Cash Register if payment is CASH
        active_register = None
        if method_upper == "CASH":
            active_register = CashRegisterService.get_active(db, current_user.gym_id)
            if not active_register:
                raise ValueError("No se puede registrar pago de membresía en efectivo sin una caja abierta.")

        payment = Payment(
            gym_id=current_user.gym_id,
            membership_id=membership.id,
            amount=pay_amount,
            payment_method=method_upper,
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

            if linked_ar and linked_ar.is_active:
                old_balance = Decimal(str(linked_ar.balance_due))
                old_paid = Decimal(str(linked_ar.paid_amount))

                linked_ar.paid_amount = old_paid + pay_amount
                linked_ar.balance_due = max(
                    Decimal("0.00"),
                    Decimal(str(linked_ar.original_amount)) - linked_ar.paid_amount,
                )
                linked_ar.status = (
                    "PAID" if linked_ar.balance_due <= Decimal("0.00") else "PARTIAL"
                )

                audit = AuditLog(
                    gym_id=current_user.gym_id,
                    user_id=current_user.id,
                    action="CREDIT_PAYMENT_REGISTERED",
                    entity_type="AccountsReceivable",
                    entity_id=linked_ar.id,
                    old_values=json.dumps({
                        "balance_due": str(old_balance),
                        "paid_amount": str(old_paid),
                    }),
                    new_values=json.dumps({
                        "balance_due": str(linked_ar.balance_due),
                        "paid_amount": str(linked_ar.paid_amount),
                        "payment_amount": str(pay_amount),
                        "source": "POST /payments/",
                    }),
                    ip_address="system",
                )
                db.add(audit)

            db.flush()
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
        current_user: User | None = None,
    ):
        was_paid = bool(payment.is_active and payment.status == PaymentStatus.PAID)
        pay_amount = Decimal(str(payment.amount or "0.00"))

        with DatabaseTransaction(db):
            PaymentService.reverse_payment_in_tx(
                db=db,
                payment=payment,
                current_user=current_user,
                reason=f"Anulación contable de pago #{payment.id}",
            )

            if was_paid and pay_amount > Decimal("0.00"):
                target_ar = None
                if payment.accounts_receivable_id:
                    target_ar = (
                        db.query(AccountsReceivable)
                        .filter(
                            AccountsReceivable.id == payment.accounts_receivable_id,
                            AccountsReceivable.gym_id == payment.gym_id,
                        )
                        .first()
                    )
                elif payment.membership_id:
                    target_ar = PaymentService.find_membership_receivable(
                        db, payment.gym_id, payment.membership_id
                    )

                if target_ar and target_ar.is_active and target_ar.status != "CANCELLED":
                    target_ar.paid_amount = max(
                        Decimal("0.00"),
                        Decimal(str(target_ar.paid_amount)) - pay_amount,
                    )
                    target_ar.balance_due = max(
                        Decimal("0.00"),
                        Decimal(str(target_ar.original_amount)) - target_ar.paid_amount,
                    )
                    if target_ar.paid_amount == Decimal("0.00"):
                        target_ar.status = "PENDING"
                    elif target_ar.balance_due == Decimal("0.00"):
                        target_ar.status = "PAID"
                    else:
                        target_ar.status = "PARTIAL"

            if current_user:
                audit = AuditLog(
                    gym_id=payment.gym_id,
                    user_id=current_user.id,
                    action="PAYMENT_CANCELLED",
                    entity_type="Payment",
                    entity_id=payment.id,
                    old_values=json.dumps({
                        "amount": str(pay_amount),
                        "status": "PAID" if was_paid else payment.status,
                    }),
                    new_values=json.dumps({
                        "status": PaymentStatus.CANCELLED,
                        "is_active": False,
                    }),
                    ip_address="system",
                )
                db.add(audit)
            db.flush()