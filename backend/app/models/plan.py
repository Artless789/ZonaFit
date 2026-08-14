from sqlalchemy import Column, Integer, String, Boolean, Numeric, Enum, DateTime
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.database.base import Base

class BillingInterval(str, enum.Enum):
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="COP")
    billing_interval = Column(Enum(BillingInterval), nullable=False, default=BillingInterval.MONTHLY)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="plan")
