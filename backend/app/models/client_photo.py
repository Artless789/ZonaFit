from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    LargeBinary,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func

from app.database.base import Base


class ClientPhoto(Base):
    __tablename__ = "client_photos"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    filename = Column(String(64), nullable=False, unique=True, index=True)
    content_type = Column(String(64), nullable=False)
    file_size = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client = relationship("Client", backref=backref("photo_record", uselist=False, cascade="all, delete-orphan"))
    gym = relationship("Gym")
