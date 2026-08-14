from sqlalchemy.orm import Session

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

        with DatabaseTransaction(db):
            db.add(product)
            db.flush()
            db.refresh(product)

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
    ):
        update_data = product_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(product, key, value)
            db.flush()
            db.refresh(product)

        return product

    @staticmethod
    def delete(
        db: Session,
        product: Product,
    ):
        with DatabaseTransaction(db):
            product.is_active = False