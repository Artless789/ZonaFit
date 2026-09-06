
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.category_service import CategoryService

from app.core.idempotency import IdempotentRoute

router = APIRouter(
    prefix="/categories",
    tags=["Categories"],
    route_class=IdempotentRoute
)


@router.post(
    "/",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return CategoryService.create(
            db,
            current_user,
            category,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[CategoryResponse],
)
def get_categories(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return CategoryService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{category_id}",
    response_model=CategoryResponse,
)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = CategoryService.get_by_id(
        db,
        current_user,
        category_id,
    )

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found.",
        )

    return category


@router.put(
    "/{category_id}",
    response_model=CategoryResponse,
)
def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = CategoryService.get_by_id(
        db,
        current_user,
        category_id,
    )

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found.",
        )

    return CategoryService.update(
        db,
        category,
        category_data,
    )


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    category = CategoryService.get_by_id(
        db,
        current_user,
        category_id,
    )

    if not category:
        raise HTTPException(
            status_code=404,
            detail="Category not found.",
        )

    CategoryService.delete(
        db,
        category,
    )