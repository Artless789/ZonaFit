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
        index=True,
    )

    client_id = Column(
        Integer,
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
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

    base_price = Column(
        Numeric(10, 2),
        nullable=True,
    )

    discount = Column(
        Numeric(10, 2),
        nullable=False,
        default=0.00,
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

    @property
    def client_name(self) -> str | None:
        return self.client.full_name if self.client else None

    @property
    def plan_name(self) -> str | None:
        return self.membership_plan.name if self.membership_plan else None