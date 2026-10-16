
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.exceptions.not_found_exception import NotFoundException
from app.models.user import User
from app.models.membership import Membership
from app.models.client import Client
from app.models.membership_plan import MembershipPlan
from app.constants.membership_status import MembershipStatus
from app.schemas.membership import (
    MembershipCreate,
    MembershipUpdate,
    MembershipResponse,
    ExpiredMembershipItem,
)
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams, PaginationResponse, calculate_total_pages
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
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    try:
        return MembershipService.create(
            db,
            current_user,
            membership,
            background_tasks,
        )
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.message),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
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
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    return MembershipService.get_all(
        db,
        current_user,
        filters,
        sort,
        params,
    )


@router.get(
    "/expired",
    response_model=PaginationResponse[ExpiredMembershipItem],
)
def get_expired_memberships(
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    if page < 1:
        raise HTTPException(status_code=422, detail="Page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=422, detail="Page size must be between 1 and 100")

    now = datetime.now(timezone.utc)

    # Subquery: client IDs who currently have an active membership with end_date >= now
    active_mem_subq = db.query(Membership.client_id).filter(
        Membership.gym_id == current_user.gym_id,
        Membership.is_active == True,
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date >= now,
    )

    # Subquery: latest end_date among expired memberships per client
    latest_expired_subq = (
        db.query(
            Membership.client_id.label("client_id"),
            func.max(Membership.end_date).label("max_end_date"),
        )
        .filter(
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True,
            Membership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
            Membership.end_date < now,
            Membership.client_id.not_in(active_mem_subq),
        )
        .group_by(Membership.client_id)
        .subquery()
    )

    # Deduplicate strictly to exactly 1 membership ID per client
    latest_expired_ids = (
        db.query(func.max(Membership.id).label("m_id"))
        .join(
            latest_expired_subq,
            and_(
                Membership.client_id == latest_expired_subq.c.client_id,
                Membership.end_date == latest_expired_subq.c.max_end_date,
            ),
        )
        .filter(
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True,
        )
        .group_by(Membership.client_id)
        .subquery()
    )

    query = (
        db.query(Membership)
        .join(latest_expired_ids, Membership.id == latest_expired_ids.c.m_id)
        .join(Client, Client.id == Membership.client_id)
        .join(MembershipPlan, MembershipPlan.id == Membership.membership_plan_id)
        .filter(
            Membership.gym_id == current_user.gym_id,
            Membership.is_active == True,
        )
    )

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Client.full_name.ilike(search_term),
                Client.document.ilike(search_term),
                Client.phone.ilike(search_term),
                MembershipPlan.name.ilike(search_term),
            )
        )

    query = query.order_by(Membership.end_date.desc(), Membership.id.desc())

    total = query.count()
    total_pages = calculate_total_pages(total, page_size)
    offset = (page - 1) * page_size
    memberships = query.offset(offset).limit(page_size).all()

    items = []
    for m in memberships:
        end_dt = m.end_date if (m.end_date and m.end_date.tzinfo) else (
            m.end_date.replace(tzinfo=timezone.utc) if m.end_date else now
        )
        days_exp = abs((now - end_dt).days)

        items.append(
            ExpiredMembershipItem(
                id=m.id,
                client_id=m.client_id,
                client_name=m.client.full_name if m.client else "Desconocido",
                client_document=m.client.document if m.client else None,
                client_phone=m.client.phone if m.client else None,
                client_photo_url=m.client.photo_url if m.client else None,
                plan_id=m.membership_plan_id,
                plan_name=m.membership_plan.name if m.membership_plan else "Desconocido",
                price=m.price,
                end_date=m.end_date,
                days_expired=days_exp,
            )
        )

    return PaginationResponse[ExpiredMembershipItem](
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
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
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    membership = MembershipService.get_by_id(
        db,
        current_user,
        membership_id,
    )

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership not found.",
        )

    MembershipService.delete(
        db,
        membership,
        current_user,
    )