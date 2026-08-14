import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from datetime import datetime, timedelta
from app.database.database import SessionLocal
from app.models.membership import Membership
from app.models.client import Client
from app.models.gym_settings import GymSettings
from app.models.notification import Notification
from app.services.notification_service import NotificationService
from sqlalchemy import text

def run_expiration_cron(days_warning=3):
    """
    Find active memberships expiring exactly in `days_warning` days and send them a warning.
    """
    db = SessionLocal()
    try:
        # We need to bypass RLS to run across all gyms since this is a global cron job
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        # Target date is exactly days_warning days from today
        target_date = datetime.now().date() + timedelta(days=days_warning)

        # Get memberships expiring on target date
        expiring_memberships = db.query(Membership).filter(
            Membership.status == "ACTIVE",
            Membership.is_active == True,
            Membership.end_date == target_date
        ).all()

        print(f"[CRON] Found {len(expiring_memberships)} memberships expiring on {target_date}")

        for membership in expiring_memberships:
            client = db.query(Client).filter(Client.id == membership.client_id).first()
            gym_settings = db.query(GymSettings).filter(GymSettings.gym_id == membership.gym_id).first()

            if not client or not client.phone:
                continue

            # Idempotency: Check if we already sent a warning to this client for this membership expiration date
            existing_notif = db.query(Notification).filter(
                Notification.gym_id == membership.gym_id,
                Notification.client_id == client.id,
                Notification.event_type == "MEMBERSHIP_EXPIRY",
                Notification.message_body.like(f"%{target_date}%")
            ).first()

            if existing_notif:
                print(f"[CRON] Skipping notification for client {client.id} (already sent).")
                continue

            context = {
                "client_name": client.full_name,
                "gym_name": gym_settings.trade_name if gym_settings else "ZonaFit Gym",
                "expiry_date": str(target_date),
            }

            notif = NotificationService.dispatch_from_template(
                db=db,
                gym_id=membership.gym_id,
                event_type="MEMBERSHIP_EXPIRY",
                channel="WHATSAPP",
                recipient=client.phone,
                context=context,
                client_id=client.id,
            )

            if notif:
                # We send it synchronously here because this is a background CRON script 
                # (no FastAPI event loop / BackgroundTasks)
                print(f"[CRON] Created MEMBERSHIP_EXPIRY notification {notif.id} for client {client.id}")
                try:
                    NotificationService.send_and_update(notif.id)
                    print(f"[CRON] Successfully dispatched notification {notif.id}")
                except Exception as e:
                    print(f"[CRON] Error dispatching notification {notif.id}: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    run_expiration_cron()
