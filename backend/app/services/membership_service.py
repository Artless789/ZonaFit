from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.not_found_exception import NotFoundException
from app.models.client import Client
from app.models.membership import Membership
from app.models.membership_plan import MembershipPlan
from app.models.user import User
from app.schemas.membership import (
    MembershipCreate,
    MembershipUpdate,
)
from app.constants.membership_status import MembershipStatus
from app.schemas.pagination import PaginationParams
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_filters, apply_sort


class MembershipService:

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        membership_data: MembershipCreate,
        background_tasks: "fastapi.BackgroundTasks" = None,
    ):
        import fastapi

        client = (
            db.query(Client)
            .filter(
                Client.id == membership_data.client_id,
                Client.gym_id == current_user.gym_id,
                Client.is_active == True,
            )
            .first()
        )

        if not client:
            raise NotFoundException("Client not found.")

        plan = (
            db.query(MembershipPlan)
            .filter(
                MembershipPlan.id == membership_data.membership_plan_id,
                MembershipPlan.gym_id == current_user.gym_id,
                MembershipPlan.is_active == True,
            )
            .first()
        )

        if not plan:
            raise NotFoundException("Membership plan not found.")

        start_date = datetime.now()

        end_date = start_date + timedelta(
            days=plan.duration_days
        )

        membership = Membership(
            gym_id=current_user.gym_id,
            client_id=client.id,
            membership_plan_id=plan.id,
            start_date=start_date,
            end_date=end_date,
            price=plan.price,
            status=MembershipStatus.ACTIVE,
            trainer_name=membership_data.trainer_name,
        )

        with DatabaseTransaction(db):
            db.add(membership)
            db.flush()
            db.refresh(membership)

        # --- NOTIFICATION HOOK: MEMBERSHIP_SOLD ---
        try:
            from app.models.gym_settings import GymSettings
            from app.services.notification_service import NotificationService
            
            gym_settings = db.query(GymSettings).filter(GymSettings.gym_id == current_user.gym_id).first()
            
            if client and client.phone:
                context = {
                    "client_name": client.full_name,
                    "gym_name": gym_settings.trade_name if gym_settings else "ZonaFit Gym",
                    "membership_name": plan.name,
                    "plan_name": plan.name,
                    "amount": str(plan.price),
                    "expiry_date": end_date.strftime("%Y-%m-%d"),
                }
                
                notif = NotificationService.dispatch_from_template(
                    db=db,
                    gym_id=current_user.gym_id,
                    event_type="MEMBERSHIP_SOLD",
                    channel="WHATSAPP",
                    recipient=client.phone,
                    context=context,
                    client_id=client.id,
                )
                if notif and background_tasks:
                    background_tasks.add_task(
                        NotificationService.send_and_update,
                        notification_id=notif.id,
                    )
        except Exception:
            pass

        return membership

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        params: PaginationParams,
    ):

        query = (
            db.query(Membership)
            .filter(
                Membership.gym_id == current_user.gym_id,
                Membership.is_active == True,
            )
        )

        query = apply_filters(
            query=query,
            filters=filters,
            search_fields=[
                Membership.status,
            ],
        )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "start_date": Membership.start_date,
                "end_date": Membership.end_date,
                "status": Membership.status,
                "created_at": Membership.created_at,
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
        membership_id: int,
    ):
        return (
            db.query(Membership)
            .filter(
                Membership.id == membership_id,
                Membership.gym_id == current_user.gym_id,
            )
            .first()
        )

    @staticmethod
    def update(
        db: Session,
        membership: Membership,
        membership_data: MembershipUpdate,
    ):
        update_data = membership_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(membership, key, value)
            db.flush()
            db.refresh(membership)

        return membership

    @staticmethod
    def delete(
        db: Session,
        membership: Membership,
    ):
        with DatabaseTransaction(db):
            membership.is_active = False