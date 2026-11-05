from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON

from app.database.base import Base
from sqlalchemy.orm import relationship, validates


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    gym_id = Column(Integer, ForeignKey("gyms.id"), index=True, nullable=True)

    full_name = Column(String(100), nullable=False)
    email = Column(String(150), index=True, nullable=False)
    password = Column(String(255), nullable=False)

    role = Column(String(30), nullable=False)
    permissions = Column(JSON, nullable=True)

    is_active = Column(Boolean, default=True)
    gym = relationship("Gym", back_populates="users", foreign_keys=[gym_id])

    @validates("email")
    def validate_email(self, key, address):
        if address is not None:
            return address.strip().lower()
        return address
