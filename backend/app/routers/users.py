from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import require_user_management
from app.database.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.user_service import UserService

router = APIRouter(
    prefix="/users",
    tags=["Usuarios"],
)


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create staff user",
    description="Registers a new gym staff user. Requires user management permissions.",
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_management),
):
    try:
        return UserService.create(
            db,
            current_user,
            user_data,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[UserResponse],
    summary="List staff users",
    description="Lists all staff users for the authenticated gym. Requires user management permissions.",
)
def get_users(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_management),
):
    return UserService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieves a staff user by ID. Requires user management permissions.",
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_management),
):
    user = UserService.get_by_id(
        db,
        current_user,
        user_id,
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado.",
        )

    return user


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update staff user",
    description="Updates a staff user. Requires user management permissions. Users cannot update their own role or permissions.",
)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_management),
):
    user = UserService.get_by_id(
        db,
        current_user,
        user_id,
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado.",
        )

    try:
        return UserService.update(
            db,
            current_user,
            user,
            user_data,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
