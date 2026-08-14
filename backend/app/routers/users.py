from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
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
)
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return UserService.create(
            db,
            current_user,
            user_data,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[UserResponse],
)
def get_users(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
