from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    JSON,
)
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

    action = Column(String(30), nullable=False)

    entity_type = Column(String(100), nullable=False)

    entity_id = Column(Integer, nullable=True)

    old_values = Column(JSON, nullable=True)

    new_values = Column(JSON, nullable=True)

    ip_address = Column(String(45), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
