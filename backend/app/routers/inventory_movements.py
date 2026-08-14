
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.inventory_movement import (
    InventoryMovementCreate,
    InventoryMovementResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.inventory_movement_service import (
    InventoryMovementService,
)

router = APIRouter(
    prefix="/inventory-movements",
    tags=["Inventory Movements"],
)


@router.post(
    "/",
    response_model=InventoryMovementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_inventory_movement(
    movement: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return InventoryMovementService.create(
            db,
            current_user,
            movement,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[InventoryMovementResponse],
)
def get_inventory_movements(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return InventoryMovementService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{movement_id}",
    response_model=InventoryMovementResponse,
)
def get_inventory_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    movement = InventoryMovementService.get_by_id(
        db,
        current_user,
        movement_id,
    )

    if not movement:
        raise HTTPException(
            status_code=404,
            detail="Inventory movement not found.",
        )

    return movement