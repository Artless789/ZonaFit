
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.invoice_service import InvoiceService

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
)


@router.post(
    "/",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice(
    invoice: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return InvoiceService.create(
            db,
            current_user,
            invoice,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[InvoiceResponse],
)
def get_invoices(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InvoiceService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = InvoiceService.get_by_id(
        db,
        current_user,
        invoice_id,
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    return invoice


@router.put(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def update_invoice(
    invoice_id: int,
    invoice_data: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = InvoiceService.get_by_id(
        db,
        current_user,
        invoice_id,
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    return InvoiceService.update(
        db,
        invoice,
        invoice_data,
    )


@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = InvoiceService.get_by_id(
        db,
        current_user,
        invoice_id,
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found.",
        )

    InvoiceService.delete(
        db,
        invoice,
    )