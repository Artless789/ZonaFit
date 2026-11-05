from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.base import Base

class CashRegister(Base):
    __tablename__ = "cash_registers"

    __table_args__ = (
        Index(
            "uq_gym_active_cash_register",
            "gym_id",
            unique=True,
            postgresql_where=text("status = 'OPEN'"),
            sqlite_where=text("status = 'OPEN'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    opened_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    closed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    opened_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    closed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    opening_balance = Column(
        Numeric(10, 2),
        nullable=False,
        default=0,
    )

    expected_balance = Column(
        Numeric(10, 2),
        nullable=True,
    )

    counted_balance = Column(
        Numeric(10, 2),
        nullable=True,
    )

    difference = Column(
        Numeric(10, 2),
        nullable=True,
    )

    status = Column(
        String(20),
        default="OPEN",
        nullable=False,
    )

    close_type = Column(
        String(20),
        default="MANUAL",
        nullable=False,
    )

    closing_notes = Column(
        Text,
        nullable=True,
    )

    reconciliation_data = Column(
        Text,
        nullable=True,
    )

    gym = relationship("Gym", backref="cash_registers")
    opened_by_user = relationship("User", foreign_keys=[opened_by])
    closed_by_user = relationship("User", foreign_keys=[closed_by])
    movements = relationship("CashMovement", back_populates="cash_register", cascade="all, delete-orphan")
