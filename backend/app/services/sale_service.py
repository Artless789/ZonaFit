from decimal import Decimal

from sqlalchemy.orm import Session

from app.constants.sale_status import SaleStatus
from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from app.exceptions.not_found_exception import NotFoundException
from app.models.client import Client
from app.models.sale import Sale
from app.models.user import User
from app.schemas.sale import (
    SaleCreate,
    SaleUpdate,
)
from app.models.sale_detail import SaleDetail
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class SaleService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        sale_data: SaleCreate,
    ):

        client_id = None
        if sale_data.client_id:
            client = (
                db.query(Client)
                .filter(
                    Client.id == sale_data.client_id,
                    Client.gym_id == current_user.gym_id,
                    Client.is_active == True,
                )
                .first()
            )

            if not client:
                raise NotFoundException("Client not found.")
            client_id = client.id

        sale = Sale(
            gym_id=current_user.gym_id,
            client_id=client_id,
            total=Decimal("0.00"),
            status=SaleStatus.OPEN,
            notes=sale_data.notes,
        )

        with DatabaseTransaction(db):
            db.add(sale)
            db.flush()
            db.refresh(sale)

        return sale

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Sale)
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Sale.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "total": Sale.total,
                "status": Sale.status,
                "created_at": Sale.created_at,
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
        sale_id: int,
    ):
        return (
            db.query(Sale)
            .filter(
                Sale.id == sale_id,
                Sale.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        sale: Sale,
        sale_data: SaleUpdate,
    ):
        update_data = sale_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(sale, key, value)
            db.flush()
            db.refresh(sale)

        return sale

    @staticmethod
    def complete(
        db: Session,
        current_user: User,
        sale_id: int,
        request: "SaleCompleteRequest",
    ):
        from app.models.payment import Payment
        from app.models.accounts_receivable import AccountsReceivable
        from app.models.audit_log import AuditLog
        from app.services.cash_register_service import CashRegisterService
        import json

        sale = (
            db.query(Sale)
            .filter(
                Sale.id == sale_id,
                Sale.gym_id == current_user.gym_id,
                Sale.is_active == True,
            )
            .first()
        )

        if not sale:
            raise ValueError("Sale not found.")

        if sale.status == SaleStatus.COMPLETED:
            raise ValueError("Sale is already completed.")

        has_details = (
            db.query(SaleDetail)
            .filter(
                SaleDetail.sale_id == sale.id,
            )
            .first()
        )

        if not has_details:
            raise ValueError(
                "Cannot complete a sale without products."
            )

        with DatabaseTransaction(db):
            sale.status = SaleStatus.COMPLETED
            
            # Logic for CASH vs CREDIT
            if request.sale_type.upper() == "CASH":
                if not request.payment_method:
                    raise ValueError("CASH sales require a payment method.")
                
                # Verify Cash Register if payment is CASH
                active_register = None
                if request.payment_method.upper() == "CASH":
                    active_register = CashRegisterService.get_active(db, current_user.gym_id)
                    if not active_register:
                        raise ValueError("No se puede registrar pago en efectivo sin una caja abierta.")

                payment = Payment(
                    gym_id=current_user.gym_id,
                    sale_id=sale.id,
                    amount=sale.total,
                    payment_method=request.payment_method,
                    status="PAID"
                )
                db.add(payment)
                db.flush()

                if active_register:
                    CashRegisterService.add_movement(
                        db=db,
                        current_user=current_user,
                        register=active_register,
                        amount=sale.total,
                        type="IN",
                        category="SALE",
                        description=f"Venta contado #{sale.id}",
                        payment_id=payment.id
                    )

            elif request.sale_type.upper() == "CREDIT":
                if not sale.client_id:
                    raise ValueError("Credit sales require an associated client.")
                if request.initial_payment < Decimal("0.00"):
                    raise ValueError("Initial payment cannot be negative.")
                if request.initial_payment > sale.total:
                    raise ValueError(f"Initial payment ({request.initial_payment}) cannot exceed the total sale amount ({sale.total}).")
                
                if request.initial_payment > Decimal("0.00") and not request.payment_method:
                    raise ValueError("A payment method is required if an initial payment is provided.")
                
                paid_amount = request.initial_payment
                balance_due = sale.total - paid_amount
                
                if paid_amount == Decimal("0.00"):
                    ar_status = "PENDING"
                elif paid_amount == sale.total:
                    ar_status = "PAID"
                else:
                    ar_status = "PARTIAL"
                
                accounts_receivable = AccountsReceivable(
                    gym_id=current_user.gym_id,
                    client_id=sale.client_id,
                    sale_id=sale.id,
                    original_amount=sale.total,
                    paid_amount=paid_amount,
                    balance_due=balance_due,
                    due_date=request.due_date,
                    status=ar_status
                )
                db.add(accounts_receivable)
                db.flush() # Need the AR ID for the payment
                
                if paid_amount > Decimal("0.00"):
                    # Verify Cash Register if payment is CASH
                    active_register = None
                    if request.payment_method.upper() == "CASH":
                        active_register = CashRegisterService.get_active(db, current_user.gym_id)
                        if not active_register:
                            raise ValueError("No se puede registrar abono en efectivo sin una caja abierta.")

                    payment = Payment(
                        gym_id=current_user.gym_id,
                        accounts_receivable_id=accounts_receivable.id,
                        amount=paid_amount,
                        payment_method=request.payment_method,
                        status="PAID"
                    )
                    db.add(payment)
                    db.flush()

                    if active_register:
                        CashRegisterService.add_movement(
                            db=db,
                            current_user=current_user,
                            register=active_register,
                            amount=paid_amount,
                            type="IN",
                            category="CREDIT_PAYMENT",
                            description=f"Abono inicial crédito #{accounts_receivable.id}",
                            payment_id=payment.id
                        )
                
                audit = AuditLog(
                    gym_id=current_user.gym_id,
                    user_id=current_user.id,
                    action="CREDIT_SALE_CREATED",
                    entity_type="Sale",
                    entity_id=sale.id,
                    new_values=json.dumps({
                        "total": str(sale.total), 
                        "due_date": str(request.due_date),
                        "initial_payment": str(paid_amount)
                    }),
                    ip_address="system"
                )
                db.add(audit)
            else:
                raise ValueError("Invalid sale_type. Must be CASH or CREDIT.")

            db.flush()
            db.refresh(sale)

        return sale

    @staticmethod
    def delete(
        db: Session,
        sale: Sale,
    ):
        with DatabaseTransaction(db):
            sale.is_active = False