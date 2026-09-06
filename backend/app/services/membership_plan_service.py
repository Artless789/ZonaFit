from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.conflict_exception import ConflictException
from app.models.membership_plan import MembershipPlan
from app.models.user import User
from app.schemas.membership_plan import (
    MembershipPlanCreate,
    MembershipPlanUpdate,
)
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class MembershipPlanService:

    @staticmethod
    def create_plan(
        db: Session,
        current_user: User,
        plan_data: MembershipPlanCreate,
    ):

        existing_plan = (
            db.query(MembershipPlan)
            .filter(
                MembershipPlan.gym_id == current_user.gym_id,
                MembershipPlan.name == plan_data.name,
            )
            .first()
        )

        if existing_plan:
            raise ConflictException("A plan with this name already exists.")

        if plan_data.duration_days <= 0:
            raise ValueError("Plan duration must be greater than 0 days.")

        if plan_data.price < 0:
            raise ValueError("Plan price cannot be negative.")

        plan = MembershipPlan(
            gym_id=current_user.gym_id,
            name=plan_data.name,
            description=plan_data.description,
            duration_days=plan_data.duration_days,
            price=plan_data.price,
        )

        with DatabaseTransaction(db):
            db.add(plan)
            db.flush()
            db.refresh(plan)

        return plan

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(MembershipPlan)
            .filter(
                MembershipPlan.gym_id == current_user.gym_id,
            )
        )

        if filters.status:
            status_lower = filters.status.lower()
            if status_lower == "active":
                query = query.filter(MembershipPlan.is_active == True)
            elif status_lower == "inactive":
                query = query.filter(MembershipPlan.is_active == False)

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                MembershipPlan.name,
                MembershipPlan.description,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "name": MembershipPlan.name,
                "price": MembershipPlan.price,
                "duration_days": MembershipPlan.duration_days,
                "created_at": MembershipPlan.created_at,
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
        plan_id: int,
    ):
        return (
            db.query(MembershipPlan)
            .filter(
                MembershipPlan.id == plan_id,
                MembershipPlan.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        plan: MembershipPlan,
        plan_data: MembershipPlanUpdate,
    ):
        if plan_data.duration_days is not None and plan_data.duration_days <= 0:
            raise ValueError("Plan duration must be greater than 0 days.")

        if plan_data.price is not None and plan_data.price < 0:
            raise ValueError("Plan price cannot be negative.")

        update_data = plan_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(plan, key, value)
            db.flush()
            db.refresh(plan)

        return plan

    @staticmethod
    def delete(
        db: Session,
        plan: MembershipPlan,
    ):
        with DatabaseTransaction(db):
            plan.is_active = False