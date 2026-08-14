from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class Client(Base):
    __tablename__ = "clients"

    __table_args__ = (
        UniqueConstraint(
            "gym_id",
            "document",
            name="uq_client_gym_document",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(Integer, ForeignKey("gyms.id"), index=True, nullable=False)

    full_name = Column(String(150), nullable=False)

    document_type = Column(String(10), nullable=False)

    document = Column(String(30), index=True, nullable=False)

    phone = Column(String(20), nullable=False)

    email = Column(String(150), index=True, nullable=True)

    notes = Column(Text, nullable=True)

    photo_url = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    gym = relationship("Gym", back_populates="clients")
    memberships = relationship("Membership",back_populates="client",)
    sales = relationship("Sale", back_populates="client")
    accounts_receivables = relationship("AccountsReceivable", back_populates="client")  