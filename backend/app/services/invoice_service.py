from decimal import Decimal
from sqlalchemy.orm import Session, joinedload, selectinload

from app.constants.invoice_status import InvoiceStatus
from app.constants.sale_status import SaleStatus
from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException
from app.models.invoice import Invoice
from app.models.sale import Sale
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
)
from app.models.sale_detail import SaleDetail
from app.schemas.invoice_detail import InvoiceDetailCreate
from app.services.invoice_detail_service import (
    InvoiceDetailService,
)
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class InvoiceService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        invoice_data: InvoiceCreate,
    ) -> Invoice:

        sale = (
            db.query(Sale)
            .filter(
                Sale.id == invoice_data.sale_id,
                Sale.gym_id == current_user.gym_id,
                Sale.is_active == True,
            )
            .first()
        )

        if not sale:
            raise NotFoundException("Sale not found.")

        if sale.status != SaleStatus.COMPLETED:
            raise BusinessException(
                "Only completed sales can be invoiced."
            )

        existing_invoice = (
            db.query(Invoice)
            .filter(
                Invoice.sale_id == sale.id,
            )
            .first()
        )

        if existing_invoice:
            raise ConflictException(
                "This sale already has an invoice."
            )

        invoice_count = (
            db.query(Invoice)
            .filter(
                Invoice.gym_id == current_user.gym_id,
            )
            .count()
        )

        invoice_number = (
            f"FAC-{current_user.gym_id}-{invoice_count + 1:06d}"
        )

        invoice = Invoice(
            gym_id=current_user.gym_id,
            sale_id=sale.id,
            invoice_number=invoice_number,
            subtotal=sale.total,
            tax=Decimal("0.00"),
            discount=Decimal("0.00"),
            total=sale.total,
            status=InvoiceStatus.ISSUED,
        )

        with DatabaseTransaction(db):
            db.add(invoice)

            db.flush()

            sale_details = (
                db.query(SaleDetail)
                .filter(
                    SaleDetail.sale_id == sale.id,
                )
                .all()
            )

            details_data = [
                InvoiceDetailCreate(
                    invoice_id=invoice.id,
                    product_id=detail.product_id,
                    quantity=detail.quantity,
                    unit_price=detail.unit_price,
                    subtotal=detail.subtotal,
                )
                for detail in sale_details
            ]

            if details_data:
                InvoiceDetailService.create_batch(
                    db=db,
                    details_data=details_data,
                )

            db.flush()
            db.refresh(invoice)

        return InvoiceService.get_by_id(db, current_user, invoice.id) or invoice

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.sale).joinedload(Sale.client),
                joinedload(Invoice.sale).selectinload(Sale.payments),
            )
            .filter(
                Invoice.gym_id == current_user.gym_id,
                Invoice.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Invoice.invoice_number,
                Invoice.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "invoice_number": Invoice.invoice_number,
                "total": Invoice.total,
                "status": Invoice.status,
                "created_at": Invoice.created_at,
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
        invoice_id: int,
    ):
        return (
            db.query(Invoice)
            .options(
                joinedload(Invoice.sale).joinedload(Sale.client),
                joinedload(Invoice.sale).selectinload(Sale.payments),
            )
            .filter(
                Invoice.id == invoice_id,
                Invoice.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        invoice: Invoice,
        invoice_data: InvoiceUpdate,
    ):
        update_data = invoice_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(invoice, key, value)
            db.flush()
            db.refresh(invoice)

        return invoice

    @staticmethod
    def delete(
        db: Session,
        invoice: Invoice,
    ):
        with DatabaseTransaction(db):
            invoice.is_active = False