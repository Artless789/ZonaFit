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

class AccountsReceivable(Base):
    __tablename__ = "accounts_receivables"

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

    sale_id = Column(
        Integer,
        ForeignKey("sales.id"),
        nullable=False,
        unique=True,
    )

    original_amount = Column(
        Numeric(10, 2),
        nullable=False,
    )

    paid_amount = Column(
        Numeric(10, 2),
        default=0,
        nullable=False,
    )

    balance_due = Column(
        Numeric(10, 2),
        nullable=False,
    )

    due_date = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    status = Column(
        String(20),
        default="PENDING",
        nullable=False,
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
        back_populates="accounts_receivables",
    )

    client = relationship(
        "Client",
        back_populates="accounts_receivables",
    )

    sale = relationship(
        "Sale",
        back_populates="accounts_receivable",
        uselist=False,
    )

    payments = relationship(
        "Payment",
        back_populates="accounts_receivable",
        cascade="all, delete-orphan",
    )

    @property
    def client_name(self) -> str | None:
        return self.client.full_name if self.client else None
