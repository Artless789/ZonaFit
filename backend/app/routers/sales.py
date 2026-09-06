
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.sale import (
    SaleCreate,
    SaleUpdate,
    SaleResponse,
    SaleCompleteRequest,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.sale_service import SaleService

from app.core.idempotency import IdempotentRoute

router = APIRouter(
    prefix="/sales",
    tags=["Sales"],
    route_class=IdempotentRoute
)


@router.post(
    "/",
    response_model=SaleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_sale(
    sale: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return SaleService.create(
            db,
            current_user,
            sale,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[SaleResponse],
)
def get_sales(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SaleService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{sale_id}",
    response_model=SaleResponse,
)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = SaleService.get_by_id(
        db,
        current_user,
        sale_id,
    )

    if not sale:
        raise HTTPException(
            status_code=404,
            detail="Sale not found.",
        )

    return sale


@router.put(
    "/{sale_id}",
    response_model=SaleResponse,
)
def update_sale(
    sale_id: int,
    sale_data: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = SaleService.get_by_id(
        db,
        current_user,
        sale_id,
    )

    if not sale:
        raise HTTPException(
            status_code=404,
            detail="Sale not found.",
        )

    return SaleService.update(
        db,
        sale,
        sale_data,
    )

@router.post(
    "/{sale_id}/complete",
    response_model=SaleResponse,
)
def complete_sale(
    sale_id: int,
    request: SaleCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return SaleService.complete(
            db,
            current_user,
            sale_id,
            request,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
@router.delete(
    "/{sale_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sale = SaleService.get_by_id(
        db,
        current_user,
        sale_id,
    )

    if not sale:
        raise HTTPException(
            status_code=404,
            detail="Sale not found.",
        )

    SaleService.delete(
        db,
        sale,
    )