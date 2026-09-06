from sqlalchemy import Column, Integer, String, Boolean, Numeric, Enum, DateTime, Text, JSON
from sqlalchemy.orm import relationship
import enum
from datetime import datetime, timezone
from app.database.base import Base

class BillingInterval(str, enum.Enum):
    MONTHLY = "MONTHLY"
    BIMONTHLY = "BIMONTHLY"
    QUARTERLY = "QUARTERLY"
    SEMIANNUAL = "SEMIANNUAL"
    YEARLY = "YEARLY"

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="COP")
    billing_interval = Column(Enum(BillingInterval, native_enum=False), nullable=False, default=BillingInterval.MONTHLY)
    is_active = Column(Boolean, default=True)
    is_popular = Column(Boolean, default=False, nullable=True)
    features = Column(JSON, default=list, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    subscriptions = relationship("Subscription", back_populates="plan")
