from datetime import date
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.report import (
    LowStockProductResponse,
    MembershipExpiringResponse,
    PaymentMethodReportResponse,
    SalesByClientResponse,
    SalesByDateResponse,
    SalesReportResponse,
    TopProductResponse,
)
from app.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


@router.get(
    "/sales",
    response_model=SalesReportResponse,
)
def get_sales_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_sales_report(
        db,
        current_user,
    )


@router.get(
    "/sales-by-date",
    response_model=SalesByDateResponse,
)
def get_sales_by_date(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_sales_by_date(
        db,
        current_user,
        start_date,
        end_date,
    )


@router.get(
    "/sales-by-client",
    response_model=List[SalesByClientResponse],
)
def get_sales_by_client(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_sales_by_client(
        db,
        current_user,
    )


@router.get(
    "/top-products",
    response_model=List[TopProductResponse],
)
def get_top_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_top_products(
        db,
        current_user,
    )


@router.get(
    "/low-stock",
    response_model=List[LowStockProductResponse],
)
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_low_stock_products(
        db,
        current_user,
    )


@router.get(
    "/payments-by-method",
    response_model=List[PaymentMethodReportResponse],
)
def get_payments_by_method(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_payments_by_method(
        db,
        current_user,
    )


@router.get(
    "/memberships-expiring",
    response_model=List[MembershipExpiringResponse],
)
def get_memberships_expiring(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ReportService.get_memberships_expiring(
        db,
        current_user,
        days,
    )