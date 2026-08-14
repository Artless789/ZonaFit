from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Membership(Base):
    __tablename__ = "memberships"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    client_id = Column(
        Integer,
        ForeignKey("clients.id"),
        nullable=False,
    )

    membership_plan_id = Column(
        Integer,
        ForeignKey("membership_plans.id"),
        nullable=False,
    )

    start_date = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    end_date = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    price = Column(
        Numeric(10, 2),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
    )

    is_active = Column(
        Boolean,
        default=True,
    )

    trainer_name = Column(
        String(100),
        nullable=True,
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
        back_populates="memberships",
    )

    client = relationship(
        "Client",
        back_populates="memberships",
    )

    membership_plan = relationship(
        "MembershipPlan",
        back_populates="memberships",
    )
    payments = relationship(
    "Payment",
    back_populates="membership",
)