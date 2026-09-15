from typing import Optional

from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException
from app.models.notification_template import NotificationTemplate
from app.models.user import User
from app.schemas.notification_template import (
    NotificationTemplateCreate,
    NotificationTemplateUpdate,
)
from app.schemas.pagination import PaginationParams
from app.schemas.sort import SortParams
from app.utils.query import paginate, apply_sort


class NotificationTemplateService:

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        params: PaginationParams,
        sort: SortParams,
        event_type: Optional[str] = None,
        channel: Optional[str] = None,
        is_active: Optional[bool] = None,
    ):
        query = (
            db.query(NotificationTemplate)
            .filter(NotificationTemplate.gym_id == current_user.gym_id)
        )

        if event_type:
            query = query.filter(NotificationTemplate.event_type == event_type)
        if channel:
            query = query.filter(NotificationTemplate.channel == channel.upper())
        if is_active is not None:
            query = query.filter(NotificationTemplate.is_active == is_active)

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "event_type": NotificationTemplate.event_type,
                "channel": NotificationTemplate.channel,
                "created_at": NotificationTemplate.created_at,
                "custom_event_name": NotificationTemplate.custom_event_name,
            },
        )

        return paginate(query=query, params=params)

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        template_id: int,
    ) -> NotificationTemplate:
        template = (
            db.query(NotificationTemplate)
            .filter(
                NotificationTemplate.id == template_id,
                NotificationTemplate.gym_id == current_user.gym_id,
            )
            .first()
        )

        if not template:
            raise NotFoundException("Notification template not found.")

        return template

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        data: NotificationTemplateCreate,
    ) -> NotificationTemplate:
        dumped = data.model_dump()
        event_type = dumped["event_type"]
        if event_type == "CUSTOM" or (dumped.get("custom_event_name") and not event_type.startswith("CUSTOM_")):
            clean_name = "".join(c if c.isalnum() else "_" for c in (dumped.get("custom_event_name") or "EVENT").strip().upper())
            clean_name = clean_name[:30] or "EVENT"
            event_type = f"CUSTOM_{clean_name}"
            dumped["event_type"] = event_type

        existing = (
            db.query(NotificationTemplate)
            .filter(
                NotificationTemplate.gym_id == current_user.gym_id,
                NotificationTemplate.event_type == event_type,
                NotificationTemplate.channel == data.channel,
            )
            .first()
        )

        if existing:
            raise ConflictException(
                f"A template for event '{event_type}' on channel "
                f"'{data.channel}' already exists. Update it instead."
            )

        template = NotificationTemplate(
            gym_id=current_user.gym_id,
            **dumped,
        )

        with DatabaseTransaction(db):
            db.add(template)
            db.flush()
            db.refresh(template)

        return template

    @staticmethod
    def update(
        db: Session,
        template: NotificationTemplate,
        data: NotificationTemplateUpdate,
    ) -> NotificationTemplate:
        update_data = data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(template, key, value)
            db.flush()
            db.refresh(template)

        return template
