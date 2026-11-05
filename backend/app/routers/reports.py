from datetime import date
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_financial_access
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
    ProfitReportResponse,
)
from app.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


@router.get(
    "/sales",
    response_model=SalesReportResponse,
    summary="Get global sales report",
    description="Returns global sales count and total revenue. Requires financial permissions.",
)
def get_sales_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
):
    return ReportService.get_sales_report(
        db,
        current_user,
    )


@router.get(
    "/sales-by-date",
    response_model=SalesByDateResponse,
    summary="Get sales by date range",
    description="Returns sales and income for a specific date range. Requires financial permissions.",
)
def get_sales_by_date(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
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
    summary="Get sales aggregated by client",
    description="Returns client sales and totals. Requires financial permissions.",
)
def get_sales_by_client(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
):
    return ReportService.get_sales_by_client(
        db,
        current_user,
    )


@router.get(
    "/top-products",
    response_model=List[TopProductResponse],
    summary="Get top selling products",
    description="Returns best-selling products and monetary totals. Requires financial permissions.",
)
def get_top_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
):
    return ReportService.get_top_products(
        db,
        current_user,
    )


@router.get(
    "/payments-by-method",
    response_model=List[PaymentMethodReportResponse],
    summary="Get payment totals by method",
    description="Returns totals collected by payment method. Requires financial permissions.",
)
def get_payments_by_method(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
):
    return ReportService.get_payments_by_method(
        db,
        current_user,
    )


@router.get(
    "/profits",
    response_model=ProfitReportResponse,
    summary="Get gym profit and utility report",
    description="Returns gross revenue, cost of goods sold, gross profit and margins. Requires financial permissions (Owner only by default).",
)
def get_profit_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_financial_access),
):
    return ReportService.get_profit_report(
        db,
        current_user,
    )


@router.get(
    "/low-stock",
    response_model=List[LowStockProductResponse],
    summary="Get products with low inventory",
    description="Returns operational list of products below minimum stock.",
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
    "/memberships-expiring",
    response_model=List[MembershipExpiringResponse],
    summary="Get memberships expiring soon",
    description="Returns operational list of client memberships expiring in the next N days.",
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
