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
from app.constants.invoice_status import InvoiceStatus


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    sale_id = Column(
        Integer,
        ForeignKey("sales.id"),
        nullable=False,
        unique=True,
    )

    invoice_number = Column(
        String(50),
        nullable=False,
        unique=True,
    )

    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
    )

    tax = Column(
        Numeric(10, 2),
        default=0,
        nullable=False,
    )

    discount = Column(
        Numeric(10, 2),
        default=0,
        nullable=False,
    )

    total = Column(
        Numeric(10, 2),
        nullable=False,
    )

    status = Column(
        String(20),
        default=InvoiceStatus.DRAFT,
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
        back_populates="invoices",
    )

    sale = relationship(
        "Sale",
        back_populates="invoice",
        uselist=False,
    )
    invoice_details = relationship(
        "InvoiceDetail",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )

    @property
    def client_id(self):
        return self.sale.client_id if self.sale else None

    @property
    def payment_method(self):
        if self.sale and self.sale.payments:
            for p in self.sale.payments:
                if p.is_active and p.status == "PAID":
                    return p.payment_method
            return self.sale.payments[0].payment_method
        return "CASH"