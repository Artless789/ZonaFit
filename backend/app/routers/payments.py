
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.payment import (
    PaymentCreate,
    PaymentUpdate,
    PaymentResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.payment_service import PaymentService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"],
)


from fastapi import BackgroundTasks

@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment(
    payment: PaymentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return PaymentService.create(
            db,
            current_user,
            payment,
            background_tasks,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[PaymentResponse],
)
def get_payments(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return PaymentService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = PaymentService.get_by_id(
        db,
        current_user,
        payment_id,
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    return payment


@router.put(
    "/{payment_id}",
    response_model=PaymentResponse,
)
def update_payment(
    payment_id: int,
    payment_data: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = PaymentService.get_by_id(
        db,
        current_user,
        payment_id,
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    return PaymentService.update(
        db,
        payment,
        payment_data,
    )


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = PaymentService.get_by_id(
        db,
        current_user,
        payment_id,
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Payment not found.",
        )

    PaymentService.delete(
        db,
        payment,
    )