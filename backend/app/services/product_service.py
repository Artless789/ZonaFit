from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException
from app.models.category import Category
from app.models.product import Product
from app.models.user import User

from app.schemas.filter import FilterParams
from app.schemas.pagination import PaginationParams
from app.schemas.sort import SortParams

from app.utils.query import (
    paginate,
    apply_filters,
    apply_sort,
)

from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
)

class ProductService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        product_data: ProductCreate,
    ):

        category = (
            db.query(Category)
            .filter(
                Category.id == product_data.category_id,
                Category.gym_id == current_user.gym_id,
                Category.is_active == True,
            )
            .first()
        )

        if not category:
            raise NotFoundException("Category not found.")

        existing_product = (
            db.query(Product)
            .filter(
                Product.gym_id == current_user.gym_id,
                Product.sku == product_data.sku,
            )
            .first()
        )

        if existing_product:
            raise ConflictException("SKU already exists.")

        product = Product(
            gym_id=current_user.gym_id,
            category_id=product_data.category_id,
            name=product_data.name,
            description=product_data.description,
            sku=product_data.sku,
            purchase_price=product_data.purchase_price,
            sale_price=product_data.sale_price,
            stock=product_data.stock,
            minimum_stock=product_data.minimum_stock,
        )

        try:
            with DatabaseTransaction(db):
                db.add(product)
                db.flush()

                from app.services.audit_service import AuditService
                from app.constants.audit_actions import AuditAction, AuditModule
                AuditService.log(
                    db=db,
                    gym_id=current_user.gym_id,
                    action=AuditAction.PRODUCT_CREATED,
                    module=AuditModule.INVENTORY,
                    entity_type="Product",
                    entity_id=product.id,
                    entity_name=product.name,
                    user_id=current_user.id,
                    user_name=current_user.full_name,
                    description=f"{current_user.full_name} creó el producto {product.name}",
                    new_values={
                        "name": product.name,
                        "sku": product.sku,
                        "sale_price": str(product.sale_price),
                        "stock": product.stock,
                    },
                )
                db.refresh(product)
        except IntegrityError:
            raise ConflictException("SKU already exists.")

        return product

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Product)
            .filter(
                Product.gym_id == current_user.gym_id,
                Product.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Product.name,
                Product.sku,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "name": Product.name,
                "stock": Product.stock,
                "sale_price": Product.sale_price,
                "purchase_price": Product.purchase_price,
                "created_at": Product.created_at,
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
        product_id: int,
    ):
        return (
            db.query(Product)
            .filter(
                Product.id == product_id,
                Product.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        product: Product,
        product_data: ProductUpdate,
        current_user: User = None,
    ):
        update_data = product_data.model_dump(exclude_unset=True)
        old_values = {
            "name": product.name,
            "sku": product.sku,
            "sale_price": str(product.sale_price),
            "purchase_price": str(product.purchase_price) if product.purchase_price else None,
            "stock": product.stock,
        }

        if "sku" in update_data and update_data["sku"] != product.sku:
            existing_product = (
                db.query(Product)
                .filter(
                    Product.gym_id == product.gym_id,
                    Product.sku == update_data["sku"],
                    Product.id != product.id,
                )
                .first()
            )
            if existing_product:
                raise ConflictException("SKU already exists.")

        try:
            with DatabaseTransaction(db):
                for key, value in update_data.items():
                    setattr(product, key, value)
                db.flush()

                if current_user:
                    from app.services.audit_service import AuditService
                    from app.constants.audit_actions import AuditAction, AuditModule
                    new_values = {
                        "name": product.name,
                        "sku": product.sku,
                        "sale_price": str(product.sale_price),
                        "purchase_price": str(product.purchase_price) if product.purchase_price else None,
                        "stock": product.stock,
                    }
                    AuditService.log(
                        db=db,
                        gym_id=product.gym_id,
                        action=AuditAction.PRODUCT_UPDATED,
                        module=AuditModule.INVENTORY,
                        entity_type="Product",
                        entity_id=product.id,
                        entity_name=product.name,
                        user_id=current_user.id,
                        user_name=current_user.full_name,
                        description=f"{current_user.full_name} modificó el producto {product.name}",
                        old_values=old_values,
                        new_values=new_values,
                    )
                db.refresh(product)
        except IntegrityError:
            raise ConflictException("SKU already exists.")

        return product

    @staticmethod
    def delete(
        db: Session,
        product: Product,
        current_user: User = None,
    ):
        with DatabaseTransaction(db):
            product.is_active = False
            if current_user:
                from app.services.audit_service import AuditService
                from app.constants.audit_actions import AuditAction, AuditModule
                AuditService.log(
                    db=db,
                    gym_id=product.gym_id,
                    action=AuditAction.PRODUCT_DEACTIVATED,
                    module=AuditModule.INVENTORY,
                    entity_type="Product",
                    entity_id=product.id,
                    entity_name=product.name,
                    user_id=current_user.id,
                    user_name=current_user.full_name,
                    description=f"{current_user.full_name} desactivó el producto {product.name}",
                    old_values={"is_active": True},
                    new_values={"is_active": False},
                )