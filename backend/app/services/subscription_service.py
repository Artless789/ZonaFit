from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.audit_log import AuditLog
from app.models.gym import Gym

class SubscriptionService:
    GRACE_PERIOD_DAYS = 3

    @staticmethod
    def get_current_subscription(db: Session, gym_id: int) -> Subscription | None:
        """
        Returns the active/lifetime subscription for the gym if any exists.
        Otherwise returns the most recent one (e.g., expired or cancelled).
        """
        subs = db.query(Subscription).filter(Subscription.gym_id == gym_id).order_by(Subscription.id.desc()).all()
        if not subs:
            return None
            
        # Prioritize active, lifetime or grace period subscriptions
        for sub in subs:
            if SubscriptionService.is_active(sub):
                return sub
                
        # Fallback to the latest
        return subs[0]

    @staticmethod
    def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
        if dt is None:
            return None
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    @staticmethod
    def is_in_grace_period(subscription: Optional[Subscription]) -> bool:
        if not subscription or subscription.is_lifetime:
            return False
            
        # Only active, past_due, or expired subscriptions with an end date can have grace period
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        if ends_at and ends_at < now:
            grace_end = ends_at + timedelta(days=SubscriptionService.GRACE_PERIOD_DAYS)
            return now <= grace_end
            
        return False

    @staticmethod
    def get_grace_period_ends_at(subscription: Optional[Subscription]) -> Optional[datetime]:
        if not subscription or not subscription.ends_at or subscription.is_lifetime:
            return None
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        if not ends_at:
            return None
        return ends_at + timedelta(days=SubscriptionService.GRACE_PERIOD_DAYS)

    @staticmethod
    def get_days_left_in_grace(subscription: Optional[Subscription]) -> Optional[int]:
        if not SubscriptionService.is_in_grace_period(subscription) or not subscription or not subscription.ends_at:
            return None
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        if not ends_at:
            return None
        grace_end = ends_at + timedelta(days=SubscriptionService.GRACE_PERIOD_DAYS)
        diff = grace_end - now
        days = diff.days if diff.days >= 0 else 0
        return days

    @staticmethod
    def can_request_emergency_extension(subscription: Optional[Subscription]) -> bool:
        if not subscription or subscription.is_lifetime:
            return False
            
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        
        # Eligible only if subscription is expired (or in grace period)
        if not ends_at or ends_at > now:
            return False
            
        # Check cooldown (allowed once every 180 days)
        last_ext = SubscriptionService._normalize_dt(subscription.last_emergency_extension_at)
        if last_ext:
            cooldown_end = last_ext + timedelta(days=180)
            if now < cooldown_end:
                return False
                
        return True

    @staticmethod
    def apply_emergency_extension(subscription: Subscription, db: Optional[Session] = None, user_id: Optional[int] = None) -> datetime:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        base_time = now if (not ends_at or ends_at < now) else ends_at
        new_ends_at = base_time + timedelta(hours=24)
        
        subscription.ends_at = new_ends_at
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.last_emergency_extension_at = now
        subscription.updated_at = now
        
        if db is not None:
            audit = AuditLog(
                gym_id=subscription.gym_id,
                user_id=user_id,
                action="EMERGENCY_EXT_GRANTED",
                entity_type="SUBSCRIPTION",
                entity_id=subscription.id,
                new_values={"details": f"24h emergency extension granted until {new_ends_at.isoformat()}"}
            )
            db.add(audit)
            db.commit()
            db.refresh(subscription)
        return new_ends_at

    @staticmethod
    def is_active(subscription: Subscription) -> bool:
        if not subscription:
            return False
            
        if subscription.is_lifetime:
            return True
            
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        starts_at = SubscriptionService._normalize_dt(subscription.starts_at)
        ends_at = SubscriptionService._normalize_dt(subscription.ends_at)
        
        if subscription.status != SubscriptionStatus.ACTIVE and subscription.status != SubscriptionStatus.TRIAL and subscription.status != SubscriptionStatus.PAST_DUE:
            return False
            
        if starts_at and starts_at > now:
            return False
            
        if ends_at and ends_at < now:
            # Check grace period! During grace period, the gym remains operationally active
            if SubscriptionService.is_in_grace_period(subscription):
                return True
            return False
            
        return True

    @staticmethod
    def has_active_subscription(db: Session, gym_id: int) -> bool:
        sub = SubscriptionService.get_current_subscription(db, gym_id)
        return SubscriptionService.is_active(sub)
