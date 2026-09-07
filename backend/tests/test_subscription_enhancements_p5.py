import pytest
from datetime import datetime, timezone, timedelta
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.subscription_payment import SubscriptionPayment, TransactionStatus
from app.services.subscription_service import SubscriptionService

def test_grace_period_calculation():
    """Test that a subscription is properly recognized in grace period within 3 days after ends_at."""
    now = datetime.now(timezone.utc)
    
    # Active subscription - ends in future -> NOT in grace period
    sub_active = Subscription(
        status=SubscriptionStatus.ACTIVE,
        ends_at=now + timedelta(days=2),
        is_lifetime=False
    )
    assert not SubscriptionService.is_in_grace_period(sub_active)
    assert SubscriptionService.is_active(sub_active)

    # Ended 1 day ago -> IN grace period (operational continuity active)
    sub_grace = Subscription(
        status=SubscriptionStatus.ACTIVE,
        ends_at=now - timedelta(days=1),
        is_lifetime=False
    )
    assert SubscriptionService.is_in_grace_period(sub_grace)
    assert SubscriptionService.is_active(sub_grace)
    days_left = SubscriptionService.get_days_left_in_grace(sub_grace)
    assert days_left >= 1

    # Ended 4 days ago -> Grace period EXPIRED
    sub_expired_grace = Subscription(
        status=SubscriptionStatus.ACTIVE,
        ends_at=now - timedelta(days=4),
        is_lifetime=False
    )
    assert not SubscriptionService.is_in_grace_period(sub_expired_grace)
    assert not SubscriptionService.is_active(sub_expired_grace)

def test_emergency_extension_cooldown():
    """Test emergency extension eligibility and 180-day cooldown."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Sub with no previous extension -> can request
    sub = Subscription(
        status=SubscriptionStatus.ACTIVE,
        ends_at=now - timedelta(days=2),
        last_emergency_extension_at=None
    )
    assert SubscriptionService.can_request_emergency_extension(sub)

    # Apply extension
    new_ends_at = SubscriptionService.apply_emergency_extension(sub)
    assert new_ends_at is not None
    assert sub.last_emergency_extension_at is not None
    assert sub.ends_at > now  # Extended by 24h

    # Immediately after -> CANNOT request again due to cooldown
    assert not SubscriptionService.can_request_emergency_extension(sub)

    # Sub with extension 200 days ago -> CAN request again
    sub_past_cooldown = Subscription(
        status=SubscriptionStatus.ACTIVE,
        ends_at=now - timedelta(days=1),
        last_emergency_extension_at=now - timedelta(days=200)
    )
    assert SubscriptionService.can_request_emergency_extension(sub_past_cooldown)

def test_payment_void_status():
    """Test subscription payment model supports void/refund columns."""
    payment = SubscriptionPayment(
        gym_id=1,
        reference="SUB-TEST-123456",
        amount_in_cents=19900000,
        currency="COP",
        status=TransactionStatus.VOIDED,
        refund_reason="Solicitud dentro de garantía",
        refunded_at=datetime.now(timezone.utc)
    )
    assert payment.status == TransactionStatus.VOIDED
    assert payment.refund_reason == "Solicitud dentro de garantía"
    assert payment.refunded_at is not None

def test_trial_active_regardless_of_clock_drift():
    """Test that a newly registered TRIAL subscription is always active even if starts_at appears in future due to clock skew."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Trial created with starts_at slightly ahead (simulating server ahead of client or clock skew)
    sub_trial = Subscription(
        status=SubscriptionStatus.TRIAL,
        starts_at=now + timedelta(seconds=30),
        ends_at=now + timedelta(days=14),
        is_lifetime=False
    )
    assert SubscriptionService.is_active(sub_trial) is True

def test_active_clock_drift_tolerance():
    """Test that ACTIVE subscriptions allow a 5-minute clock-drift tolerance."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Starts in 2 minutes (within 5 min tolerance) -> considered active
    sub_recent = Subscription(
        status=SubscriptionStatus.ACTIVE,
        starts_at=now + timedelta(minutes=2),
        ends_at=now + timedelta(days=30),
        is_lifetime=False
    )
    assert SubscriptionService.is_active(sub_recent) is True
    
    # Starts in 10 minutes (beyond 5 min tolerance) -> future-scheduled, not active yet
    sub_future = Subscription(
        status=SubscriptionStatus.ACTIVE,
        starts_at=now + timedelta(minutes=10),
        ends_at=now + timedelta(days=30),
        is_lifetime=False
    )
    assert SubscriptionService.is_active(sub_future) is False

