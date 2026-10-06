from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base
from app.constants.sale_status import SaleStatus


class Sale(Base):
    __tablename__ = "sales"

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
        nullable=True,
        index=True,
    )

    total = Column(
        Numeric(10, 2),
        default=0,
        nullable=False,
    )

    status = Column(
        String(20),
        default=SaleStatus.OPEN,   
        nullable=False,
    )

    notes = Column(
        Text,
        nullable=True,
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
        back_populates="sales",
    )

    client = relationship(
        "Client",
        back_populates="sales",
    )

    sale_details = relationship(
        "SaleDetail",
        back_populates="sale",
        cascade="all, delete-orphan",
    ) 
    invoice = relationship(
        "Invoice",
        back_populates="sale",
        uselist=False,
    )

    accounts_receivable = relationship(
        "AccountsReceivable",
        back_populates="sale",
        uselist=False,
        cascade="all, delete-orphan",
    )

    payments = relationship(
        "Payment",
        back_populates="sale",
        cascade="all, delete-orphan",
    )

    @property
    def is_membership_shadow(self) -> bool:
        return bool(self.notes and self.notes.startswith("Membresía #"))

    @property
    def origin_type(self) -> str:
        return "MEMBERSHIP_CREDIT" if self.is_membership_shadow else "POS"