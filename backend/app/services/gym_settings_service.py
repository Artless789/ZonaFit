from sqlalchemy.orm import Session

from app.core.database_transaction import DatabaseTransaction
from app.exceptions.conflict_exception import ConflictException
from app.exceptions.not_found_exception import NotFoundException
from app.models.gym_settings import GymSettings
from app.models.gym import Gym
from app.models.user import User
from app.schemas.gym_settings import GymSettingsCreate, GymSettingsUpdate


class GymSettingsService:

    @staticmethod
    def get_by_gym_id(
        db: Session,
        current_user: User,
    ) -> GymSettings:
        settings = (
            db.query(GymSettings)
            .filter(GymSettings.gym_id == current_user.gym_id)
            .first()
        )

        if not settings:
            raise NotFoundException(
                "Gym settings not found. Please create them first."
            )

        return settings

    @staticmethod
    def create(
        db: Session,
        current_user: User,
        settings_data: GymSettingsCreate,
    ) -> GymSettings:
        existing = (
            db.query(GymSettings)
            .filter(GymSettings.gym_id == current_user.gym_id)
            .first()
        )

        if existing:
            raise ConflictException(
                "Gym settings already exist. Use the update endpoint instead."
            )

        settings = GymSettings(
            gym_id=current_user.gym_id,
            **settings_data.model_dump(),
        )

        with DatabaseTransaction(db):
            db.add(settings)
            db.flush()
            db.refresh(settings)

        return settings

    @staticmethod
    def update(
        db: Session,
        settings: GymSettings,
        settings_data: GymSettingsUpdate,
        current_user: User = None,
    ) -> GymSettings:
        update_data = settings_data.model_dump(exclude_unset=True)
        old_values = {
            "trade_name": settings.trade_name,
            "legal_name": settings.legal_name,
            "phone": settings.phone,
            "address": settings.address,
        }

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(settings, key, value)
            db.flush()

            if current_user:
                from app.services.audit_service import AuditService
                from app.constants.audit_actions import AuditAction, AuditModule
                new_values = {
                    "trade_name": settings.trade_name,
                    "legal_name": settings.legal_name,
                    "phone": settings.phone,
                    "address": settings.address,
                }
                AuditService.log(
                    db=db,
                    gym_id=settings.gym_id,
                    action=AuditAction.GYM_SETTINGS_UPDATED,
                    module=AuditModule.SETTINGS,
                    entity_type="GymSettings",
                    entity_id=settings.id,
                    entity_name=settings.trade_name or "Configuración del Gimnasio",
                    user_id=current_user.id,
                    user_name=current_user.full_name,
                    description=f"{current_user.full_name} actualizó la configuración del gimnasio",
                    old_values=old_values,
                    new_values=new_values,
                )
            db.refresh(settings)

        return settings

    @staticmethod
    def complete_onboarding(
        db: Session,
        current_user: User,
    ):
        gym = db.query(Gym).filter(Gym.id == current_user.gym_id).first()
        if not gym:
            raise NotFoundException("Gym not found.")
            
        with DatabaseTransaction(db):
            gym.onboarding_completed = True
            db.flush()

