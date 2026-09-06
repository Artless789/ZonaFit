from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.dashboard import DashboardResponse, IncomeDetailsResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)


@router.get(
    "/",
    response_model=DashboardResponse,
)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DashboardService.get_dashboard(
        db,
        current_user,
    )


@router.get(
    "/income-details",
    response_model=IncomeDetailsResponse,
)
def get_income_details(
    month: Optional[int] = Query(None, ge=1, le=12, description="Mes calendario 1-12"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Año calendario"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DashboardService.get_income_details(
        db,
        current_user,
        month=month,
        year=year,
    )