from sqlalchemy.orm import Session

from app.constants.inventory_movement_types import InventoryMovementType
from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from app.exceptions.not_found_exception import NotFoundException
from app.models.inventory_movement import InventoryMovement
from app.models.product import Product
from app.models.user import User
from app.schemas.inventory_movement import (
    InventoryMovementCreate,
)
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class InventoryMovementService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        movement_data: InventoryMovementCreate,
    ):

        product = (
            db.query(Product)
            .filter(
                Product.id == movement_data.product_id,
                Product.gym_id == current_user.gym_id,
                Product.is_active == True,
            )
            .with_for_update()
            .first()
        )

        if not product:
            raise NotFoundException("Product not found.")

        stock_before = product.stock

        if movement_data.movement_type == InventoryMovementType.IN:
            stock_after = stock_before + movement_data.quantity

        elif movement_data.movement_type == InventoryMovementType.OUT:

            if stock_before < movement_data.quantity:
                raise BusinessException("Not enough stock.")

            stock_after = stock_before - movement_data.quantity

        elif movement_data.movement_type == InventoryMovementType.ADJUSTMENT:
            stock_after = movement_data.quantity

        else:
            raise BusinessException("Invalid movement type.")

        movement = InventoryMovement(
            gym_id=current_user.gym_id,
            product_id=product.id,
            movement_type=movement_data.movement_type,
            quantity=movement_data.quantity,
            stock_before=stock_before,
            stock_after=stock_after,
            reason=movement_data.reason,
        )

        product.stock = stock_after

        with DatabaseTransaction(db):
            db.add(movement)
            db.flush()

            from app.services.audit_service import AuditService
            from app.constants.audit_actions import AuditAction, AuditModule
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=AuditAction.INVENTORY_MOVEMENT,
                module=AuditModule.INVENTORY,
                entity_type="Product",
                entity_id=product.id,
                entity_name=product.name,
                user_id=current_user.id,
                user_name=current_user.full_name,
                description=f"{current_user.full_name} registró movimiento de inventario ({movement_data.movement_type}: {movement_data.quantity}) en {product.name}",
                old_values={"stock": stock_before},
                new_values={
                    "stock": stock_after,
                    "movement_type": movement_data.movement_type,
                    "quantity": movement_data.quantity,
                    "reason": movement_data.reason,
                },
            )
            db.refresh(movement)

        return movement

    @staticmethod
    def register_sale_output(
        db: Session,
        current_user: User,
        product: Product,
        quantity: int,
        reason: str,
    ):

        stock_before = product.stock

        if stock_before < quantity:
            raise BusinessException("Not enough stock.")

        stock_after = stock_before - quantity

        movement = InventoryMovement(
            gym_id=current_user.gym_id,
            product_id=product.id,
            movement_type=InventoryMovementType.OUT,
            quantity=quantity,
            stock_before=stock_before,
            stock_after=stock_after,
            reason=reason,
        )

        product.stock = stock_after

        db.add(movement)

        return movement


    @staticmethod
    def reverse_sale_output(
        db: Session,
        current_user: User,
        product: Product,
        quantity: int,
        reason: str,
    ):

        stock_before = product.stock

        stock_after = stock_before + quantity

        movement = InventoryMovement(
            gym_id=current_user.gym_id,
            product_id=product.id,
            movement_type=InventoryMovementType.IN,
            quantity=quantity,
            stock_before=stock_before,
            stock_after=stock_after,
            reason=reason,
        )

        product.stock = stock_after

        db.add(movement)

        return movement

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(InventoryMovement)
            .filter(
                InventoryMovement.gym_id == current_user.gym_id,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                InventoryMovement.movement_type,
                InventoryMovement.reason,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "movement_type": InventoryMovement.movement_type,
                "quantity": InventoryMovement.quantity,
                "created_at": InventoryMovement.created_at,
            },
        )

        return paginate(
            query=query,
            params=params,
        )

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        movement_id: int,
    ):
        return (
            db.query(InventoryMovement)
            .filter(
                InventoryMovement.id == movement_id,
                InventoryMovement.gym_id == current_user.gym_id,
            )
            .first()
        )