from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.gym import Gym

class SubscriptionService:
    @staticmethod
    def get_current_subscription(db: Session, gym_id: int) -> Subscription | None:
        """
        Returns the active/lifetime subscription for the gym if any exists.
        Otherwise returns the most recent one (e.g., expired or cancelled).
        """
        subs = db.query(Subscription).filter(Subscription.gym_id == gym_id).order_by(Subscription.id.desc()).all()
        if not subs:
            return None
            
        # Prioritize active or lifetime subscriptions
        for sub in subs:
            if SubscriptionService.is_active(sub):
                return sub
                
        # Fallback to the latest
        return subs[0]

    @staticmethod
    def is_active(subscription: Subscription) -> bool:
        if not subscription:
            return False
            
        if subscription.is_lifetime:
            return True
            
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        if subscription.status != SubscriptionStatus.ACTIVE and subscription.status != SubscriptionStatus.TRIAL:
            return False
            
        if subscription.starts_at and subscription.starts_at > now:
            return False
            
        if subscription.ends_at and subscription.ends_at < now:
            return False
            
        return True

    @staticmethod
    def has_active_subscription(db: Session, gym_id: int) -> bool:
        sub = SubscriptionService.get_current_subscription(db, gym_id)
        return SubscriptionService.is_active(sub)
