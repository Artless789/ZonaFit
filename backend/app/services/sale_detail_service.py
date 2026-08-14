from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from app.exceptions.not_found_exception import NotFoundException
from app.models.product import Product
from app.models.sale import Sale
from app.models.sale_detail import SaleDetail
from app.models.user import User
from app.schemas.sale_detail import (
    SaleDetailCreate,
    SaleDetailUpdate,
)
from app.services.inventory_movement_service import (
    InventoryMovementService,
)
from app.schemas.pagination import PaginationParams
from app.utils.pagination import paginate


class SaleDetailService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        detail_data: SaleDetailCreate,
    ) -> SaleDetail:

        sale = (
            db.query(Sale)
            .filter(
                Sale.id == detail_data.sale_id,
                Sale.gym_id == current_user.gym_id,
                Sale.is_active == True,
            )
            .first()
        )

        if not sale:
            raise NotFoundException("Sale not found.")

        product = (
            db.query(Product)
            .filter(
                Product.id == detail_data.product_id,
                Product.gym_id == current_user.gym_id,
                Product.is_active == True,
            )
            .first()
        )

        if not product:
            raise NotFoundException("Product not found.")

        if product.stock < detail_data.quantity:
            raise BusinessException("Not enough stock.")

        unit_price = product.sale_price

        subtotal = (
            Decimal(detail_data.quantity)
            * unit_price
        )

        detail = SaleDetail(
            sale_id=sale.id,
            product_id=product.id,
            quantity=detail_data.quantity,
            unit_price=unit_price,
            subtotal=subtotal,
        )

        with DatabaseTransaction(db):
            db.add(detail)

            InventoryMovementService.register_sale_output(
                db=db,
                current_user=current_user,
                product=product,
                quantity=detail_data.quantity,
                reason=f"Sale #{sale.id}",
            )

            sale.total += subtotal

            db.flush()
            db.refresh(detail)

        return detail

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        params: PaginationParams,
    ):

        query = (
            db.query(SaleDetail)
            .join(Sale)
            .filter(
                Sale.gym_id == current_user.gym_id,
            )
        )

        return paginate(
            query=query,
            params=params,
        )

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        detail_id: int,
    ) -> SaleDetail | None:
        return (
            db.query(SaleDetail)
            .join(Sale)
            .options(
                joinedload(SaleDetail.sale),
                joinedload(SaleDetail.product),
            )
            .filter(
                SaleDetail.id == detail_id,
                Sale.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        detail: SaleDetail,
        detail_data: SaleDetailUpdate,
    ) -> SaleDetail:
        if detail_data.quantity is not None:
            raise BusinessException(
                "Quantity cannot be modified. Delete and recreate the detail."
            )

        return detail

    @staticmethod
    def delete(
        db: Session,
        detail: SaleDetail,
        current_user: User,
    ) -> None:

        sale = detail.sale

        product = detail.product

        with DatabaseTransaction(db):
            sale.total -= detail.subtotal

            InventoryMovementService.reverse_sale_output(
                db=db,
                current_user=current_user,
                product=product,
                quantity=detail.quantity,
                reason=f"Delete Sale Detail #{detail.id}",
            )

            db.delete(detail)