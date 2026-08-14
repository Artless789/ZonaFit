from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.database.base import Base


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    __table_args__ = (
        UniqueConstraint(
            "gym_id",
            "event_type",
            "channel",
            name="uq_template_gym_event_channel",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
        index=True,
    )

    event_type = Column(String(50), nullable=False)

    channel = Column(String(20), nullable=False)

    # Supports variables: {client_name} {expiry_date} {gym_name} {amount} {plan_name}
    template_body = Column(Text, nullable=False)

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
