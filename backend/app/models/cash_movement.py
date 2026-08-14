from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base

class CashMovement(Base):
    __tablename__ = "cash_movements"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    cash_register_id = Column(
        Integer,
        ForeignKey("cash_registers.id"),
        nullable=False,
    )

    payment_id = Column(
        Integer,
        ForeignKey("payments.id"),
        nullable=True,
    )

    amount = Column(
        Numeric(10, 2),
        nullable=False,
    )

    type = Column(
        String(20),  # "IN", "OUT"
        nullable=False,
    )

    category = Column(
        String(50),  # "SALE", "CREDIT_PAYMENT", "MANUAL_IN", "MANUAL_OUT"
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    gym = relationship("Gym", backref="cash_movements")
    cash_register = relationship("CashRegister", back_populates="movements")
    payment = relationship("Payment", backref="cash_movements")
    created_by_user = relationship("User", foreign_keys=[created_by])
