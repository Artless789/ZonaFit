from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_settings_management
from app.database.database import get_db
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException
from app.models.user import User
from app.schemas.gym_settings import (
    GymSettingsCreate,
    GymSettingsUpdate,
    GymSettingsResponse,
)
from app.services.gym_settings_service import GymSettingsService

router = APIRouter(
    prefix="/gym-settings",
    tags=["Gym Settings"],
)

@router.get(
    "/",
    response_model=GymSettingsResponse,
    summary="Get gym settings",
    description="Returns the institutional configuration of the authenticated user's gym.",
)
def get_gym_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    try:
        return GymSettingsService.get_by_gym_id(db, current_user)
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.message),
        )


@router.post(
    "/",
    response_model=GymSettingsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create gym settings",
    description="Creates the institutional configuration for the gym. Can only be done once per gym. Requires settings management permissions.",
)
def create_gym_settings(
    settings_data: GymSettingsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_settings_management),
):
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    try:
        return GymSettingsService.create(db, current_user, settings_data)
    except ConflictException as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e.message),
        )


@router.put(
    "/",
    response_model=GymSettingsResponse,
    summary="Update gym settings",
    description="Updates the institutional configuration of the gym. Requires settings management permissions.",
)
def update_gym_settings(
    settings_data: GymSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_settings_management),
):
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    try:
        settings = GymSettingsService.get_by_gym_id(db, current_user)
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.message),
        )

    return GymSettingsService.update(db, settings, settings_data, current_user=current_user)

@router.post(
    "/complete-onboarding",
    response_model=dict,
    summary="Complete gym onboarding",
    description="Marks the onboarding process as completed for the authenticated user's gym. Requires settings management permissions.",
)
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_settings_management),
):
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    try:
        GymSettingsService.complete_onboarding(db, current_user)
        return {"success": True, "message": "Onboarding completed successfully"}
    except NotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e.message),
        )
