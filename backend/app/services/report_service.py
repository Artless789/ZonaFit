from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, contains_eager

from app.constants.membership_status import MembershipStatus
from app.constants.sale_status import SaleStatus
from app.models.client import Client
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
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

class ReportService:
    @staticmethod
    def get_sales_report(
        db: Session,
        current_user: User,
    ) -> SalesReportResponse:

        total_sales = (
            db.query(Sale)
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .count()
        )

        total_income = (
            db.query(func.sum(Sale.total))
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .scalar()
        )

        if total_income is None:
            total_income = Decimal("0.00")

        return SalesReportResponse(
            total_sales=total_sales,
            total_income=total_income,
        )
    @staticmethod
    def get_sales_by_date(
        db: Session,
        current_user: User,
        start_date: date,
        end_date: date,
    ) -> SalesByDateResponse:

        total_sales = (
            db.query(Sale)
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
                func.date(Sale.created_at) >= start_date,
                func.date(Sale.created_at) <= end_date,
            )
            .count()
        )

        total_income = (
            db.query(func.sum(Sale.total))
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
                func.date(Sale.created_at) >= start_date,
                func.date(Sale.created_at) <= end_date,
            )
            .scalar()
        )

        if total_income is None:
            total_income = Decimal("0.00")

        return SalesByDateResponse(
            start_date=start_date,
            end_date=end_date,
            total_sales=total_sales,
            total_income=total_income,
        )

    @staticmethod
    def get_sales_by_client(
        db: Session,
        current_user: User,
    ) -> list[SalesByClientResponse]:

        results = (
            db.query(
                Client.id,
                Client.full_name,
                func.count(Sale.id).label("total_sales"),
                func.coalesce(func.sum(Sale.total), 0).label("total_amount"),
            )
            .join(Sale, Sale.client_id == Client.id)
            .filter(
                Client.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .group_by(
                Client.id,
                Client.full_name,
            )
            .order_by(
                func.sum(Sale.total).desc()
            )
            .all()
        )

        return [
            SalesByClientResponse(
                client_id=row.id,
                client_name=row.full_name,
                total_sales=row.total_sales,
                total_amount=row.total_amount,
            )
            for row in results
        ]
    @staticmethod
    def get_top_products(
        db: Session,
        current_user: User,
    ) -> list[TopProductResponse]:

        results = (
            db.query(
                Product.id,
                Product.name,
                func.sum(SaleDetail.quantity).label("total_quantity"),
                func.sum(SaleDetail.subtotal).label("total_amount"),
            )
            .join(
                SaleDetail,
                SaleDetail.product_id == Product.id,
            )
            .join(
                Sale,
                Sale.id == SaleDetail.sale_id,
            )
            .filter(
                Product.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .group_by(
                Product.id,
                Product.name,
            )
            .order_by(
                func.sum(SaleDetail.quantity).desc()
            )
            .all()
        )

        return [
            TopProductResponse(
                product_id=row.id,
                product_name=row.name,
                total_quantity=row.total_quantity,
                total_amount=row.total_amount,
            )
            for row in results
        ]
    @staticmethod
    def get_low_stock_products(
        db: Session,
        current_user: User,
    ) -> list[LowStockProductResponse]:

        products = (
            db.query(Product)
            .filter(
                Product.gym_id == current_user.gym_id,
                Product.is_active == True,
                Product.stock <= Product.minimum_stock,
            )
            .order_by(Product.stock.asc())
            .all()
        )

        return [
            LowStockProductResponse(
                product_id=product.id,
                product_name=product.name,
                stock=product.stock,
                min_stock=product.minimum_stock,
            )
            for product in products
        ]
    @staticmethod
    def get_payments_by_method(
        db: Session,
        current_user: User,
    ) -> list[PaymentMethodReportResponse]:

        results = (
            db.query(
                Payment.payment_method,
                func.count(Payment.id).label("total_payments"),
                func.coalesce(func.sum(Payment.amount), 0).label("total_amount"),
            )
            .filter(
                Payment.gym_id == current_user.gym_id,
                Payment.is_active == True,
            )
            .group_by(
                Payment.payment_method,
            )
            .order_by(
                func.sum(Payment.amount).desc(),
            )
            .all()
        )

        return [
            PaymentMethodReportResponse(
                payment_method=row.payment_method,
                total_payments=row.total_payments,
                total_amount=row.total_amount,
            )
            for row in results
        ]
    @staticmethod
    def get_memberships_expiring(
        db: Session,
        current_user: User,
        days: int = 7,
    ) -> list[MembershipExpiringResponse]:

        today = date.today()
        limit_date = today + timedelta(days=days)

        memberships = (
            db.query(Membership)
            .join(Client)
            .options(contains_eager(Membership.client))
            .filter(
                Membership.gym_id == current_user.gym_id,
                Membership.status == MembershipStatus.ACTIVE,
                func.date(Membership.end_date) >= today,
                func.date(Membership.end_date) <= limit_date,
            )
            .order_by(Membership.end_date.asc())
            .all()
        )

        return [
            MembershipExpiringResponse(
                membership_id=membership.id,
                client_id=membership.client.id,
                client_name=membership.client.full_name,
                end_date=membership.end_date.date(),
                days_remaining=(
                    membership.end_date.date() - today
                ).days,
            )
            for membership in memberships
        ]
    @staticmethod
    def get_profit_report(
        db: Session,
        current_user: User,
    ) -> ProfitReportResponse:
        sales_rev = (
            db.query(func.coalesce(func.sum(Sale.total), Decimal("0.00")))
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .scalar() or Decimal("0.00")
        )

        mem_rev = (
            db.query(func.coalesce(func.sum(Membership.price), Decimal("0.00")))
            .filter(
                Membership.gym_id == current_user.gym_id,
                Membership.status.in_([MembershipStatus.ACTIVE, MembershipStatus.EXPIRED]),
                Membership.is_active == True,
            )
            .scalar() or Decimal("0.00")
        )

        total_revenue = sales_rev + mem_rev

        cogs = (
            db.query(func.coalesce(func.sum(SaleDetail.quantity * Product.purchase_price), Decimal("0.00")))
            .join(Product, Product.id == SaleDetail.product_id)
            .join(Sale, Sale.id == SaleDetail.sale_id)
            .filter(
                Sale.gym_id == current_user.gym_id,
                Sale.status == SaleStatus.COMPLETED,
                Sale.is_active == True,
            )
            .scalar() or Decimal("0.00")
        )

        gross_profit = total_revenue - cogs
        margin = float((gross_profit / total_revenue) * 100) if total_revenue > Decimal("0.00") else 0.0

        return ProfitReportResponse(
            total_revenue=total_revenue,
            total_cost=cogs,
            gross_profit=gross_profit,
            profit_margin_percent=round(margin, 2),
        )
