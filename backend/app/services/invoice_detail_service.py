from sqlalchemy.orm import Session

from app.models.invoice_detail import InvoiceDetail
from app.schemas.invoice_detail import (
    InvoiceDetailCreate,
)


class InvoiceDetailService:

    @staticmethod
    def create(
        db: Session,
        detail_data: InvoiceDetailCreate,
    ):

        detail = InvoiceDetail(
            invoice_id=detail_data.invoice_id,
            product_id=detail_data.product_id,
            quantity=detail_data.quantity,
            unit_price=detail_data.unit_price,
            subtotal=detail_data.subtotal,
        )

        db.add(detail)

        db.flush()

        return detail

    @staticmethod
    def create_batch(
        db: Session,
        details_data: list[InvoiceDetailCreate],
    ) -> list[InvoiceDetail]:
        details = [
            InvoiceDetail(
                invoice_id=data.invoice_id,
                product_id=data.product_id,
                quantity=data.quantity,
                unit_price=data.unit_price,
                subtotal=data.subtotal,
            )
            for data in details_data
        ]
        if details:
            db.add_all(details)
            db.flush()
        return details

    @staticmethod
    def get_by_invoice(
        db: Session,
        invoice_id: int,
    ):
        return (
            db.query(InvoiceDetail)
            .filter(
                InvoiceDetail.invoice_id == invoice_id,
            )
            .all()
        )