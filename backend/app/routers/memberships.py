
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.membership import (
    MembershipCreate,
    MembershipUpdate,
    MembershipResponse,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.services.membership_service import MembershipService

router = APIRouter(
    prefix="/memberships",
    tags=["Memberships"],
)


@router.post(
    "/",
    response_model=MembershipResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_membership(
    membership: MembershipCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return MembershipService.create(
            db,
            current_user,
            membership,
            background_tasks,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.get(
    "/",
    response_model=PaginationResponse[MembershipResponse],
)
def get_memberships(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MembershipService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/{membership_id}",
    response_model=MembershipResponse,
)
def get_membership(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Membership not found.",
        )

    return membership


@router.put(
    "/{membership_id}",
    response_model=MembershipResponse,
)
def update_membership(
    membership_id: int,
    membership_data: MembershipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Membership not found.",
        )

    return MembershipService.update(
        db,
        membership,
        membership_data,
    )


@router.delete(
    "/{membership_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_membership(
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Membership not found.",
        )

    MembershipService.delete(
        db,
        membership,
    )