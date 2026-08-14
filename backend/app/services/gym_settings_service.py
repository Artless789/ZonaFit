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
    ) -> GymSettings:
        update_data = settings_data.model_dump(exclude_unset=True)

        with DatabaseTransaction(db):
            for key, value in update_data.items():
                setattr(settings, key, value)
            db.flush()
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

