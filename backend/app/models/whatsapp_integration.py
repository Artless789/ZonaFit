from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database.base import Base

class WhatsAppIntegration(Base):
    __tablename__ = "whatsapp_integrations"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False, index=True)
    waba_id = Column(String(100), nullable=True)
    phone_number_id = Column(String(100), nullable=False, index=True)
    business_id = Column(String(100), nullable=True)
    display_phone_number = Column(String(50), nullable=True)
    verified_name = Column(String(150), nullable=True)
    access_token_encrypted = Column(Text, nullable=False)
    status = Column(String(50), default="CONNECTED", nullable=False)
    quality_rating = Column(String(50), default="UNKNOWN", nullable=False)
    last_error = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    connected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    gym = relationship("Gym", backref="whatsapp_integrations")

    __table_args__ = (
        UniqueConstraint("gym_id", "phone_number_id", name="uq_gym_phone_number"),
    )
