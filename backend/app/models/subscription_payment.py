from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Numeric
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.database.base import Base

class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DECLINED = "DECLINED"
    VOIDED = "VOIDED"
    ERROR = "ERROR"

class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), index=True, nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), index=True, nullable=False)
    provider = Column(String(50), nullable=False, default="WOMPI")
    provider_transaction_id = Column(String(255), unique=True, index=True, nullable=True)
    reference = Column(String(255), unique=True, index=True, nullable=False)
    amount_in_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default="COP")
    status = Column(Enum(TransactionStatus), index=True, nullable=False, default=TransactionStatus.PENDING)
    payment_method_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    gym = relationship("Gym")
    subscription = relationship("Subscription")
