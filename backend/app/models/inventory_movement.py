from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False,
    )

    movement_type = Column(
        String(20),
        nullable=False,
    )

    quantity = Column(
        Integer,
        nullable=False,
    )

    stock_before = Column(
        Integer,
        nullable=False,
    )

    stock_after = Column(
        Integer,
        nullable=False,
    )

    reason = Column(
        String(255),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    gym = relationship(
        "Gym",
        back_populates="inventory_movements",
    )

    product = relationship(
        "Product",
        back_populates="inventory_movements",
    )