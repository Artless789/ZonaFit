
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)
from app.services.product_service import ProductService

from app.core.idempotency import IdempotentRoute

router = APIRouter(
    prefix="/products",
    tags=["Products"],
    route_class=IdempotentRoute
)


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProductService.create(
        db=db,
        current_user=current_user,
        product_data=product,
    )   


@router.get(
    "/",
    response_model=PaginationResponse[ProductResponse],
)

def get_products(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ProductService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )   


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = ProductService.get_by_id(
        db,
        current_user,
        product_id,
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    return product


@router.put(
    "/{product_id}",
    response_model=ProductResponse,
)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = ProductService.get_by_id(
        db,
        current_user,
        product_id,
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    return ProductService.update(
        db,
        product,
        product_data,
    )


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = ProductService.get_by_id(
        db,
        current_user,
        product_id,
    )

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found.",
        )

    ProductService.delete(
        db,
        product,
    )