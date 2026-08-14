from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.invoice import Invoice
from app.models.user import User
from app.schemas.invoice_detail import (
    InvoiceDetailResponse,
)
from app.services.invoice_detail_service import (
    InvoiceDetailService,
)

router = APIRouter(
    prefix="/invoice-details",
    tags=["Invoice Details"],
)


@router.get(
    "/{invoice_id}",
    response_model=List[InvoiceDetailResponse],
)
def get_invoice_details(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id == invoice_id,
            Invoice.gym_id == current_user.gym_id,
            Invoice.is_active == True,
        )
        .first()
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    return InvoiceDetailService.get_by_invoice(
        db,
        invoice_id,
    )