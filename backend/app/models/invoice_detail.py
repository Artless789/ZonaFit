from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class InvoiceDetail(Base):
    __tablename__ = "invoice_details"

    id = Column(Integer, primary_key=True, index=True)

    invoice_id = Column(
        Integer,
        ForeignKey("invoices.id"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    quantity = Column(
        Integer,
        nullable=False,
    )

    unit_price = Column(
        Numeric(10, 2),
        nullable=False,
    )

    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    invoice = relationship(
        "Invoice",
        back_populates="invoice_details",
    )

    product = relationship(
        "Product",
        back_populates="invoice_details",
    )