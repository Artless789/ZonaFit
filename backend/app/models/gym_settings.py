from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class GymSettings(Base):
    __tablename__ = "gym_settings"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    legal_name = Column(String(150), nullable=False)

    trade_name = Column(String(100), nullable=False)

    tax_id = Column(String(30), nullable=False)

    tax_regime = Column(String(50), nullable=True)

    official_phone = Column(String(20), nullable=False)

    official_email = Column(String(150), nullable=False)

    physical_address = Column(String(200), nullable=False)

    city = Column(String(100), nullable=False)

    country = Column(String(50), nullable=False, default="Colombia")

    currency = Column(String(3), nullable=False, default="COP")

    timezone = Column(
        String(50),
        nullable=False,
        default="America/Bogota",
    )

    default_tax_percentage = Column(
        Numeric(5, 2),
        nullable=False,
        default=0.00,
    )

    receipt_footer_notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    gym = relationship("Gym", back_populates="gym_settings")
