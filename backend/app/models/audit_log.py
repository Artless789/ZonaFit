from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    user_name = Column(String(150), nullable=True)

    action = Column(String(60), nullable=False, index=True)

    module = Column(String(50), nullable=True, index=True)

    entity_type = Column(String(100), nullable=False, index=True)

    entity_id = Column(Integer, nullable=True)

    entity_name = Column(String(200), nullable=True)

    description = Column(String(500), nullable=True)

    status = Column(String(20), nullable=True, default="SUCCESS")

    old_values = Column(JSON, nullable=True)

    new_values = Column(JSON, nullable=True)

    ip_address = Column(String(45), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
