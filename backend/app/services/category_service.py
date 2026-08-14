from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.conflict_exception import ConflictException
from app.models.category import Category
from app.models.user import User
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
)
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class CategoryService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        category_data: CategoryCreate,
    ):

        existing_category = (
            db.query(Category)
            .filter(
                Category.gym_id == current_user.gym_id,
                Category.name == category_data.name,
                Category.is_active == True,
            )
            .first()
        )

        if existing_category:
            raise ConflictException("Category already exists.")

        category = Category(
            gym_id=current_user.gym_id,
            name=category_data.name,
            description=category_data.description,
        )

        with DatabaseTransaction(db):
            db.add(category)
            db.flush()
            db.refresh(category)

        return category

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Category)
            .filter(
                Category.gym_id == current_user.gym_id,
                Category.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Category.name,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "name": Category.name,
                "created_at": Category.created_at,
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
        category_id: int,
    ):
        return (
            db.query(Category)
            .filter(
                Category.id == category_id,
                Category.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        category: Category,
        category_data: CategoryUpdate,
    ):
        update_data = category_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(category, key, value)
            db.flush()
            db.refresh(category)

        return category

    @staticmethod
    def delete(
        db: Session,
        category: Category,
    ):
        with DatabaseTransaction(db):
            category.is_active = False