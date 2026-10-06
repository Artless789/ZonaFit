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
    SaleCheckoutRequest,
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
    def checkout(
        db: Session,
        current_user: User,
        data: SaleCheckoutRequest,
    ):
        from app.models.product import Product
        from app.models.sale_detail import SaleDetail
        from app.models.payment import Payment
        from app.models.accounts_receivable import AccountsReceivable
        from app.models.audit_log import AuditLog
        from app.services.inventory_movement_service import InventoryMovementService
        from app.services.cash_register_service import CashRegisterService
        import json

        if not current_user.gym_id:
            raise BusinessException("User is not associated with a gym.")

        if not data.items or len(data.items) == 0:
            raise BusinessException("La venta debe contener al menos un producto.")

        for item in data.items:
            if item.quantity <= 0:
                raise BusinessException("La cantidad de cada producto debe ser mayor a 0.")

        sale_type_upper = (data.sale_type or "CASH").upper()
        if sale_type_upper not in ("CASH", "CREDIT"):
            raise BusinessException("El tipo de venta debe ser CASH o CREDIT.")

        # Pre-validate payment method & cash register BEFORE touching any DB entities
        active_register = None
        if sale_type_upper == "CASH":
            if not data.payment_method:
                raise BusinessException("CASH sales require a payment method.")
            if data.payment_method.upper() == "CASH":
                active_register = CashRegisterService.get_active(db, current_user.gym_id)
                if not active_register:
                    raise BusinessException("No se puede registrar pago en efectivo sin una caja abierta.")
        elif sale_type_upper == "CREDIT":
            if not data.client_id:
                raise BusinessException("Credit sales require an associated client.")
            if data.initial_payment < Decimal("0.00"):
                raise BusinessException("Initial payment cannot be negative.")
            if data.initial_payment > Decimal("0.00"):
                if not data.payment_method:
                    raise BusinessException("A payment method is required if an initial payment is provided.")
                if data.payment_method.upper() == "CASH":
                    active_register = CashRegisterService.get_active(db, current_user.gym_id)
                    if not active_register:
                        raise BusinessException("No se puede registrar abono en efectivo sin una caja abierta.")

        # Atomic transaction wrapping the entire checkout process
        with DatabaseTransaction(db):
            client_id = None
            if data.client_id:
                client = (
                    db.query(Client)
                    .filter(
                        Client.id == data.client_id,
                        Client.gym_id == current_user.gym_id,
                        Client.is_active == True,
                    )
                    .first()
                )
                if not client:
                    raise NotFoundException("Client not found.")
                client_id = client.id

            products_map = {}
            for item in data.items:
                product = (
                    db.query(Product)
                    .filter(
                        Product.id == item.product_id,
                        Product.gym_id == current_user.gym_id,
                        Product.is_active == True,
                    )
                    .with_for_update()
                    .first()
                )
                if not product:
                    raise NotFoundException(f"Product {item.product_id} not found.")
                if product.stock < item.quantity:
                    raise BusinessException(f"Stock insuficiente para el producto '{product.name}'.")
                products_map[item.product_id] = product

            sale = Sale(
                gym_id=current_user.gym_id,
                client_id=client_id,
                total=Decimal("0.00"),
                status=SaleStatus.COMPLETED,
                notes=data.notes,
            )
            db.add(sale)
            db.flush()

            total_sale = Decimal("0.00")
            for item in data.items:
                prod = products_map[item.product_id]
                subtotal = Decimal(item.quantity) * prod.sale_price
                detail = SaleDetail(
                    sale_id=sale.id,
                    product_id=prod.id,
                    quantity=item.quantity,
                    unit_price=prod.sale_price,
                    subtotal=subtotal,
                )
                db.add(detail)
                InventoryMovementService.register_sale_output(
                    db=db,
                    current_user=current_user,
                    product=prod,
                    quantity=item.quantity,
                    reason=f"Sale #{sale.id}",
                )
                total_sale += subtotal

            sale.total = total_sale

            if sale_type_upper == "CASH":
                payment = Payment(
                    gym_id=current_user.gym_id,
                    sale_id=sale.id,
                    amount=sale.total,
                    payment_method=data.payment_method,
                    status="PAID",
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
                        payment_id=payment.id,
                    )

            elif sale_type_upper == "CREDIT":
                if data.initial_payment > sale.total:
                    raise BusinessException(f"Initial payment ({data.initial_payment}) cannot exceed the total sale amount ({sale.total}).")

                paid_amount = data.initial_payment
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
                    due_date=data.due_date,
                    status=ar_status,
                )
                db.add(accounts_receivable)
                db.flush()

                if paid_amount > Decimal("0.00"):
                    payment = Payment(
                        gym_id=current_user.gym_id,
                        accounts_receivable_id=accounts_receivable.id,
                        amount=paid_amount,
                        payment_method=data.payment_method,
                        status="PAID",
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
                            payment_id=payment.id,
                        )

                audit = AuditLog(
                    gym_id=current_user.gym_id,
                    user_id=current_user.id,
                    action="CREDIT_SALE_CREATED",
                    entity_type="Sale",
                    entity_id=sale.id,
                    new_values=json.dumps({
                        "total": str(sale.total),
                        "due_date": str(data.due_date),
                        "initial_payment": str(paid_amount),
                    }),
                    ip_address="system",
                )
                db.add(audit)

            db.flush()
            db.refresh(sale)

        return sale

    @staticmethod
    def delete(
        db: Session,
        sale: Sale,
        current_user: User | None = None,
    ):
        import json
        from app.models.accounts_receivable import AccountsReceivable
        from app.models.audit_log import AuditLog
        from app.models.payment import Payment
        from app.models.product import Product
        from app.services.inventory_movement_service import InventoryMovementService
        from app.services.payment_service import PaymentService

        was_completed = bool(sale.is_active and sale.status == SaleStatus.COMPLETED)
        old_status = sale.status

        with DatabaseTransaction(db):
            sale.is_active = False
            sale.status = SaleStatus.CANCELLED

            # 1. Restore product stock if this was an active completed POS sale
            if was_completed:
                details = (
                    db.query(SaleDetail)
                    .filter(SaleDetail.sale_id == sale.id)
                    .all()
                )
                for detail in details:
                    product = (
                        db.query(Product)
                        .filter(
                            Product.id == detail.product_id,
                            Product.gym_id == sale.gym_id,
                        )
                        .first()
                    )
                    if product:
                        InventoryMovementService.reverse_sale_output(
                            db=db,
                            current_user=current_user,
                            product=product,
                            quantity=detail.quantity,
                            reason=f"Cancelación Sale #{sale.id}",
                        )

            # 2. Reverse all active direct sale payments (non-destructively)
            sale_payments = (
                db.query(Payment)
                .filter(
                    Payment.sale_id == sale.id,
                    Payment.gym_id == sale.gym_id,
                    Payment.is_active == True,
                )
                .all()
            )
            for pmt in sale_payments:
                PaymentService.reverse_payment_in_tx(
                    db=db,
                    payment=pmt,
                    current_user=current_user,
                    reason=f"Cancelación de venta #{sale.id}",
                )

            # 3. Cancel linked AccountsReceivable and reverse its payments
            ar = (
                db.query(AccountsReceivable)
                .filter(
                    AccountsReceivable.sale_id == sale.id,
                    AccountsReceivable.gym_id == sale.gym_id,
                )
                .first()
            )
            if ar:
                ar_payments = (
                    db.query(Payment)
                    .filter(
                        Payment.accounts_receivable_id == ar.id,
                        Payment.gym_id == sale.gym_id,
                        Payment.is_active == True,
                    )
                    .all()
                )
                for ar_pmt in ar_payments:
                    PaymentService.reverse_payment_in_tx(
                        db=db,
                        payment=ar_pmt,
                        current_user=current_user,
                        reason=f"Cancelación de venta a crédito #{sale.id}",
                    )
                ar.status = "CANCELLED"
                ar.balance_due = Decimal("0.00")
                ar.is_active = False

            if current_user:
                audit = AuditLog(
                    gym_id=sale.gym_id,
                    user_id=current_user.id,
                    action="SALE_CANCELLED",
                    entity_type="Sale",
                    entity_id=sale.id,
                    old_values=json.dumps({
                        "status": old_status,
                        "total": str(sale.total),
                    }),
                    new_values=json.dumps({
                        "status": SaleStatus.CANCELLED,
                        "is_active": False,
                    }),
                    ip_address="system",
                )
                db.add(audit)
            db.flush()