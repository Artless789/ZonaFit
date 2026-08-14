
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.sale_detail import (
    SaleDetailCreate,
    SaleDetailUpdate,
    SaleDetailResponse,
)
from app.services.sale_detail_service import SaleDetailService
from app.schemas.pagination import PaginationParams, PaginationResponse

router = APIRouter(
    prefix="/sale-details",
    tags=["Sale Details"],
)


@router.post(
    "/",
    response_model=SaleDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sale_detail(
    detail: SaleDetailCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return SaleDetailService.create(
            db,
            current_user,
            detail,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[SaleDetailResponse],
)
def get_sale_details(
    params: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SaleDetailService.get_all(
        db,
        current_user,
        params,
    )


@router.get(
    "/{detail_id}",
    response_model=SaleDetailResponse,
)
def get_sale_detail(
    detail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    detail = SaleDetailService.get_by_id(
        db,
        current_user,
        detail_id,
    )

    if not detail:
        raise HTTPException(
            status_code=404,
            detail="Sale detail not found.",
        )

    return detail


@router.put(
    "/{detail_id}",
    response_model=SaleDetailResponse,
)
def update_sale_detail(
    detail_id: int,
    detail_data: SaleDetailUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    detail = SaleDetailService.get_by_id(
        db,
        current_user,
        detail_id,
    )

    if not detail:
        raise HTTPException(
            status_code=404,
            detail="Sale detail not found.",
        )

    try:
        return SaleDetailService.update(
            db,
            detail,
            detail_data,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.delete(
    "/{detail_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_sale_detail(
    detail_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    detail = SaleDetailService.get_by_id(
        db,
        current_user,
        detail_id,
    )

    if not detail:
        raise HTTPException(
            status_code=404,
            detail="Sale detail not found.",
        )

    SaleDetailService.delete(
        db,
        detail,
        current_user,
    )