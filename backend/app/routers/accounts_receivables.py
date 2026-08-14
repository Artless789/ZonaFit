from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.accounts_receivable import AccountsReceivableResponse
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.accounts_receivable_service import AccountsReceivableService

router = APIRouter(
    prefix="/accounts-receivables",
    tags=["Accounts Receivables"],
)

class PaymentRequest(BaseModel):
    amount: Decimal
    payment_method: str

@router.get(
    "/",
    response_model=PaginationResponse[AccountsReceivableResponse],
)
def get_accounts_receivables(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AccountsReceivableService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )

@router.get(
    "/{ar_id}",
    response_model=AccountsReceivableResponse,
)
def get_account_receivable(
    ar_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ar = AccountsReceivableService.get_by_id(
        db,
        current_user,
        ar_id,
    )
    if not ar:
        raise HTTPException(
            status_code=404,
            detail="Accounts Receivable not found.",
        )
    return ar

from app.schemas.payment import PaymentResponse

@router.get(
    "/{ar_id}/payments",
    response_model=list[PaymentResponse],
)
def get_account_receivable_payments(
    ar_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validates AR exists and RLS
    ar = AccountsReceivableService.get_by_id(
        db,
        current_user,
        ar_id,
    )
    if not ar:
        raise HTTPException(
            status_code=404,
            detail="Accounts Receivable not found.",
        )
    
    return AccountsReceivableService.get_payments(db, ar.id)

@router.post(
    "/{ar_id}/pay",
    response_model=AccountsReceivableResponse,
)
def register_payment(
    ar_id: int,
    request: PaymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return AccountsReceivableService.register_payment(
            db,
            current_user,
            ar_id,
            request.amount,
            request.payment_method,
            background_tasks,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
