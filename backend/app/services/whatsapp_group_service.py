from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.whatsapp_group import WhatsAppGroup
from app.schemas.whatsapp_group import WhatsAppGroupCreate, WhatsAppGroupUpdate


class WhatsAppGroupService:
    @staticmethod
    def create_group(
        db: Session,
        gym_id: int,
        data: WhatsAppGroupCreate,
    ) -> WhatsAppGroup:
        # Check duplicate name within the same gym
        existing = (
            db.query(WhatsAppGroup)
            .filter(
                WhatsAppGroup.gym_id == gym_id,
                WhatsAppGroup.name.ilike(data.name.strip()),
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un grupo con este nombre en tu gimnasio.",
            )

        new_group = WhatsAppGroup(
            gym_id=gym_id,
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            invite_url=data.invite_url.strip(),
            is_active=data.is_active,
        )
        db.add(new_group)
        db.commit()
        db.refresh(new_group)
        return new_group

    @staticmethod
    def get_groups(
        db: Session,
        gym_id: int,
        is_active: Optional[bool] = None,
    ) -> List[WhatsAppGroup]:
        query = db.query(WhatsAppGroup).filter(WhatsAppGroup.gym_id == gym_id)
        if is_active is not None:
            query = query.filter(WhatsAppGroup.is_active == is_active)
        return query.order_by(WhatsAppGroup.name.asc()).all()

    @staticmethod
    def get_group(
        db: Session,
        gym_id: int,
        group_id: int,
    ) -> WhatsAppGroup:
        group = (
            db.query(WhatsAppGroup)
            .filter(
                WhatsAppGroup.id == group_id,
                WhatsAppGroup.gym_id == gym_id,
            )
            .first()
        )
        if not group:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grupo de WhatsApp no encontrado.",
            )
        return group

    @staticmethod
    def update_group(
        db: Session,
        gym_id: int,
        group_id: int,
        data: WhatsAppGroupUpdate,
    ) -> WhatsAppGroup:
        group = WhatsAppGroupService.get_group(db=db, gym_id=gym_id, group_id=group_id)

        update_dict = data.model_dump(exclude_unset=True)
        if "name" in update_dict and update_dict["name"]:
            name_val = update_dict["name"].strip()
            # Check duplicate name
            existing = (
                db.query(WhatsAppGroup)
                .filter(
                    WhatsAppGroup.gym_id == gym_id,
                    WhatsAppGroup.name.ilike(name_val),
                    WhatsAppGroup.id != group_id,
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya existe otro grupo con este nombre.",
                )
            group.name = name_val

        if "description" in update_dict:
            group.description = update_dict["description"].strip() if update_dict["description"] else None

        if "invite_url" in update_dict and update_dict["invite_url"]:
            group.invite_url = update_dict["invite_url"].strip()

        if "is_active" in update_dict and update_dict["is_active"] is not None:
            group.is_active = update_dict["is_active"]

        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def delete_group(
        db: Session,
        gym_id: int,
        group_id: int,
    ) -> None:
        group = WhatsAppGroupService.get_group(db=db, gym_id=gym_id, group_id=group_id)
        # Soft delete / toggle is_active or delete if no clients associated
        group.is_active = False
        db.commit()
