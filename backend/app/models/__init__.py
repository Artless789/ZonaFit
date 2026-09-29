from .gym import Gym
from .user import User
from .client import Client
from .membership_plan import MembershipPlan
from .membership import Membership
from .payment import Payment
from .category import Category
from .product import Product
from .sale import Sale
from .sale_detail import SaleDetail
from .inventory_movement import InventoryMovement
from .invoice import Invoice
from .invoice_detail import InvoiceDetail
from .gym_settings import GymSettings
from .audit_log import AuditLog
from .notification_template import NotificationTemplate
from .notification import Notification
from .plan import Plan
from .subscription import Subscription
from .subscription_payment import SubscriptionPayment
from .accounts_receivable import AccountsReceivable
from .password_reset_token import PasswordResetToken
from .cash_register import CashRegister
from .cash_movement import CashMovement
from .refresh_token import RefreshToken
from .idempotency_key import IdempotencyKey
from .whatsapp_integration import WhatsAppIntegration
from .whatsapp_group import WhatsAppGroup
from .client_photo import ClientPhoto

# Ensures Alembic can discover them
__all__ = [
    "WhatsAppIntegration",
    "WhatsAppGroup",
    "ClientPhoto",
    "User",
    "Gym",
    "GymSettings",
    "Plan",
    "Subscription",
    "SubscriptionPayment",
    "Category",
    "Product",
    "InventoryMovement",
    "Sale",
    "SaleDetail",
    "MembershipPlan",
    "Membership",
    "Payment",
    "AuditLog",
    "AccountsReceivable",
    "NotificationTemplate",
    "Notification",
    "Invoice",
    "InvoiceDetail",
    "PasswordResetToken",
    "CashRegister",
    "CashMovement",
    "RefreshToken",
    "IdempotencyKey"
]
