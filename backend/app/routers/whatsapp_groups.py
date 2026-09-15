from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.whatsapp_group import (
    WhatsAppGroupCreate,
    WhatsAppGroupUpdate,
    WhatsAppGroupResponse,
)
from app.services.whatsapp_group_service import WhatsAppGroupService

router = APIRouter(
    prefix="/whatsapp-groups",
    tags=["WhatsApp Groups"],
)


@router.post(
    "/",
    response_model=WhatsAppGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new WhatsApp Group invitation record",
)
def create_whatsapp_group(
    data: WhatsAppGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WhatsAppGroupService.create_group(
        db=db,
        gym_id=current_user.gym_id,
        data=data,
    )


@router.get(
    "/",
    response_model=List[WhatsAppGroupResponse],
    summary="List all WhatsApp Groups for the current gym",
)
def list_whatsapp_groups(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WhatsAppGroupService.get_groups(
        db=db,
        gym_id=current_user.gym_id,
        is_active=is_active,
    )


@router.get(
    "/{group_id}",
    response_model=WhatsAppGroupResponse,
    summary="Get a WhatsApp Group by ID",
)
def get_whatsapp_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WhatsAppGroupService.get_group(
        db=db,
        gym_id=current_user.gym_id,
        group_id=group_id,
    )


@router.put(
    "/{group_id}",
    response_model=WhatsAppGroupResponse,
    summary="Update a WhatsApp Group",
)
def update_whatsapp_group(
    group_id: int,
    data: WhatsAppGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return WhatsAppGroupService.update_group(
        db=db,
        gym_id=current_user.gym_id,
        group_id=group_id,
        data=data,
    )


@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a WhatsApp Group",
)
def delete_whatsapp_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    WhatsAppGroupService.delete_group(
        db=db,
        gym_id=current_user.gym_id,
        group_id=group_id,
    )
