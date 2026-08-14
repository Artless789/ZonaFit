from sqlalchemy import Column, Integer, String, Boolean, ForeignKey

from app.database.base import Base
from sqlalchemy.orm import relationship

class Gym(Base):
    __tablename__ = "gyms"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    phone = Column(String(20))
    address = Column(String(200))
    is_active = Column(Boolean, default=True)
    onboarding_completed = Column(Boolean, default=False)
    users = relationship("User", back_populates="gym", foreign_keys="[User.gym_id]")
    owner = relationship("User", foreign_keys=[owner_id])
    clients = relationship("Client", back_populates="gym")
    membership_plans = relationship("MembershipPlan",back_populates="gym",)
    memberships = relationship("Membership",back_populates="gym",)
    payments = relationship("Payment",back_populates="gym",)
    categories = relationship("Category", back_populates="gym")
    products = relationship("Product",back_populates="gym",)
    sales = relationship("Sale", back_populates="gym") 
    inventory_movements = relationship(
        "InventoryMovement",
        back_populates="gym",
    )   
    invoices = relationship("Invoice", back_populates="gym")
    gym_settings = relationship(
        "GymSettings",
        back_populates="gym",
        uselist=False,
    )
    subscriptions = relationship("Subscription", back_populates="gym")
    accounts_receivables = relationship("AccountsReceivable", back_populates="gym")
