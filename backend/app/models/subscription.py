from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Enum, DateTime, text
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone
from app.database.base import Base

class SubscriptionStatus(str, enum.Enum):
    TRIAL = "TRIAL"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), index=True, nullable=False)
    plan_id = Column(Integer, ForeignKey("plans.id"), index=True, nullable=True)
    status = Column(Enum(SubscriptionStatus), index=True, nullable=False, default=SubscriptionStatus.TRIAL)
    starts_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    ends_at = Column(DateTime, nullable=True)
    is_lifetime = Column(Boolean, nullable=False, default=False)
    payment_source_id = Column(String(255), nullable=True)
    payment_method_type = Column(String(50), nullable=True)
    payment_method_last4 = Column(String(4), nullable=True)
    cancellation_requested_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    gym = relationship("Gym", back_populates="subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")
