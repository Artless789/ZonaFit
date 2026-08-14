from sqlalchemy.orm import Session
from app.models.accounts_receivable import AccountsReceivable
from app.models.payment import Payment
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.cash_register_service import CashRegisterService
from app.core.database_transaction import DatabaseTransaction
from decimal import Decimal
import json
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort

class AccountsReceivableService:

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):
        query = (
            db.query(AccountsReceivable)
            .filter(
                AccountsReceivable.gym_id == current_user.gym_id,
                AccountsReceivable.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                AccountsReceivable.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "original_amount": AccountsReceivable.original_amount,
                "balance_due": AccountsReceivable.balance_due,
                "due_date": AccountsReceivable.due_date,
                "status": AccountsReceivable.status,
                "created_at": AccountsReceivable.created_at,
            },
        )

        return paginate(query=query, params=params)

    @staticmethod
    def get_by_id(db: Session, current_user: User, ar_id: int):
        return (
            db.query(AccountsReceivable)
            .filter(
                AccountsReceivable.id == ar_id,
                AccountsReceivable.gym_id == current_user.gym_id,
                AccountsReceivable.is_active == True,
            )
            .first()
        )

    @staticmethod
    def get_payments(db: Session, ar_id: int):
        return (
            db.query(Payment)
            .filter(
                Payment.accounts_receivable_id == ar_id,
            )
            .order_by(Payment.created_at.desc())
            .all()
        )

    @staticmethod
    def register_payment(
        db: Session,
        current_user: User,
        ar_id: int,
        amount: Decimal,
        payment_method: str,
        background_tasks: "fastapi.BackgroundTasks" = None,
    ):
        import fastapi
        ar = AccountsReceivableService.get_by_id(db, current_user, ar_id)
        if not ar:
            raise ValueError("Accounts Receivable not found.")

        if amount <= 0:
            raise ValueError("Payment amount must be greater than zero.")

        if amount > ar.balance_due:
            raise ValueError(
                f"Payment amount ({amount}) cannot exceed the balance due ({ar.balance_due})."
            )

        # Check cash register if CASH
        active_register = None
        if payment_method.upper() == "CASH":
            active_register = CashRegisterService.get_active(db, current_user.gym_id)
            if not active_register:
                raise ValueError("No se puede registrar abono en efectivo sin una caja abierta.")

        with DatabaseTransaction(db):
            payment = Payment(
                gym_id=current_user.gym_id,
                accounts_receivable_id=ar.id,
                amount=amount,
                payment_method=payment_method,
                status="PAID"
            )
            db.add(payment)
            db.flush()

            if active_register:
                CashRegisterService.add_movement(
                    db=db,
                    current_user=current_user,
                    register=active_register,
                    amount=amount,
                    type="IN",
                    category="CREDIT_PAYMENT",
                    description=f"Abono crédito #{ar.id}",
                    payment_id=payment.id
                )

            old_balance = ar.balance_due
            old_paid = ar.paid_amount

            ar.paid_amount += amount
            ar.balance_due -= amount

            if ar.balance_due <= 0:
                ar.status = "PAID"
            else:
                ar.status = "PARTIAL"

            audit = AuditLog(
                gym_id=current_user.gym_id,
                user_id=current_user.id,
                action="CREDIT_PAYMENT_REGISTERED",
                entity_type="AccountsReceivable",
                entity_id=ar.id,
                old_values=json.dumps({
                    "balance_due": str(old_balance),
                    "paid_amount": str(old_paid),
                }),
                new_values=json.dumps({
                    "balance_due": str(ar.balance_due),
                    "paid_amount": str(ar.paid_amount),
                    "payment_amount": str(amount)
                }),
                ip_address="system"
            )
            db.add(audit)

            db.flush()
            db.refresh(ar)

        # --- NOTIFICATION HOOK: CREDIT_PAYMENT_RECEIVED ---
        try:
            from app.models.client import Client
            from app.models.gym_settings import GymSettings
            from app.services.notification_service import NotificationService
            
            client = db.query(Client).filter(Client.id == ar.client_id).first()
            gym_settings = db.query(GymSettings).filter(GymSettings.gym_id == current_user.gym_id).first()
            
            if client and client.phone:
                context = {
                    "client_name": client.full_name,
                    "gym_name": gym_settings.trade_name if gym_settings else "ZonaFit Gym",
                    "amount": str(amount),
                    "balance_due": str(ar.balance_due),
                    "payment_method": payment_method,
                }
                
                notif = NotificationService.dispatch_from_template(
                    db=db,
                    gym_id=current_user.gym_id,
                    event_type="CREDIT_PAYMENT_RECEIVED",
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

        return ar
