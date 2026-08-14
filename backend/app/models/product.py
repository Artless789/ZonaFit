from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    category_id = Column(
        Integer,
        ForeignKey("categories.id"),
        nullable=False,
    )

    name = Column(
        String(150),
        nullable=False,
    )

    description = Column(
        String(255),
        nullable=True,
    )

    sku = Column(
        String(50),
        nullable=False,
        unique=True,
    )

    purchase_price = Column(
        Numeric(10, 2),
        nullable=False,
    )

    sale_price = Column(
        Numeric(10, 2),
        nullable=False,
    )

    stock = Column(
        Integer,
        default=0,
        nullable=False,
    )

    minimum_stock = Column(
        Integer,
        default=0,
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
        back_populates="products",
    )

    category = relationship(
        "Category",
        back_populates="products",
    )

    sale_details = relationship(
        "SaleDetail",
        back_populates="product",
    )  

    inventory_movements = relationship(
        "InventoryMovement",
        back_populates="product",
    )   
    invoice_details = relationship(
        "InvoiceDetail",
        back_populates="product",
    )   