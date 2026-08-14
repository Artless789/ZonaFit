from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        # Ensure exactly one context is provided for the payment
        CheckConstraint(
            "num_nonnulls(membership_id, sale_id, accounts_receivable_id) = 1",
            name="chk_payment_context"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    membership_id = Column(
        Integer,
        ForeignKey("memberships.id"),
        nullable=True,
    )

    sale_id = Column(
        Integer,
        ForeignKey("sales.id"),
        nullable=True,
    )

    accounts_receivable_id = Column(
        Integer,
        ForeignKey("accounts_receivables.id"),
        nullable=True,
    )

    amount = Column(
        Numeric(10, 2),
        nullable=False,
    )

    payment_method = Column(
        String(30),
        nullable=False,
    )

    reference = Column(
        String(100),
        nullable=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PAID",
    )

    is_active = Column(
        Boolean,
        default=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    gym = relationship(
        "Gym",
        back_populates="payments",
    )

    membership = relationship(
        "Membership",
        back_populates="payments",
    )

    sale = relationship(
        "Sale",
        back_populates="payments",
    )

    accounts_receivable = relationship(
        "AccountsReceivable",
        back_populates="payments",
    )