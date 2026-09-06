from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func

from app.database.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    gym_id = Column(
        Integer,
        ForeignKey("gyms.id"),
        nullable=False,
        index=True,
    )

    client_id = Column(
        Integer,
        ForeignKey("clients.id"),
        nullable=True,
        index=True,
    )

    event_type = Column(String(50), nullable=False)

    channel = Column(String(20), nullable=False)

    # Phone number or email address of the recipient
    recipient = Column(String(100), nullable=False)

    message_body = Column(Text, nullable=False)

    # PENDING | SENT | FAILED
    status = Column(String(20), index=True, nullable=False)

    error_detail = Column(Text, nullable=True)

    sent_at = Column(DateTime(timezone=True), nullable=True)

    integration_id = Column(
        Integer,
        ForeignKey("whatsapp_integrations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    provider_message_id = Column(String(100), nullable=True, index=True)

    delivery_status = Column(String(50), nullable=True)

    error_code = Column(String(50), nullable=True)

    metadata_json = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
