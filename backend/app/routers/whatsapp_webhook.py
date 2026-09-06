import os
import hmac
import hashlib
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.database import get_db
from app.models.notification import Notification
from app.models.whatsapp_integration import WhatsAppIntegration

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/webhooks/whatsapp",
    tags=["WhatsApp Webhooks"],
)

def verify_signature(body: bytes, signature_header: str | None) -> bool:
    app_secret = (
        (settings.META_WEBHOOK_SECRET and settings.META_WEBHOOK_SECRET.strip())
        or (settings.META_APP_SECRET and settings.META_APP_SECRET.strip())
        or os.getenv("WHATSAPP_APP_SECRET")
    )
    if not app_secret:
        logger.error("[WhatsApp Webhook] Fail-closed rejection: Server secret (META_APP_SECRET/META_WEBHOOK_SECRET) is not configured.")
        return False
    if not signature_header:
        logger.warning("[WhatsApp Webhook] Fail-closed rejection: Missing X-Hub-Signature-256 header.")
        return False
    
    parts = signature_header.split("sha256=")
    if len(parts) != 2:
        logger.warning("[WhatsApp Webhook] Fail-closed rejection: Malformed X-Hub-Signature-256 header.")
        return False
    expected_hash = parts[1]
    
    mac = hmac.new(app_secret.encode("utf-8"), msg=body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), expected_hash)

@router.get("", response_class=PlainTextResponse)
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    expected_token = (
        (settings.META_WEBHOOK_VERIFY_TOKEN and settings.META_WEBHOOK_VERIFY_TOKEN.strip())
        or os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "zonafit_webhook_verify_token")
    )
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("WhatsApp webhook verified successfully.")
        return hub_challenge or ""
    
    logger.warning("WhatsApp webhook verification failed.")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification failed")

@router.post("")
async def receive_webhook_event(
    request: Request,
    db: Session = Depends(get_db),
):
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    
    if not verify_signature(raw_body, signature):
        logger.warning("WhatsApp webhook rejected: Invalid, missing signature or unconfigured server secret.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook signature",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to decode webhook payload: {e}")
        return {"status": "ignored"}

    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            val = change.get("value", {})
            statuses = val.get("statuses", [])
            for st in statuses:
                msg_id = st.get("id")
                del_status = st.get("status")
                errors = st.get("errors")

                if msg_id:
                    notif = (
                        db.query(Notification)
                        .filter(Notification.provider_message_id == msg_id)
                        .first()
                    )
                    if notif:
                        notif.delivery_status = del_status.upper() if del_status else None
                        if del_status in ["failed", "undelivered"]:
                            notif.status = "FAILED"
                            if errors and isinstance(errors, list) and len(errors) > 0:
                                notif.error_code = str(errors[0].get("code", ""))
                                notif.error_detail = errors[0].get("message", "")
                        elif del_status in ["sent", "delivered", "read"]:
                            notif.status = "SENT"

                        notif.metadata_json = json.dumps(st)
                        db.commit()

            # Check for phone number quality or account updates
            field = change.get("field")
            if field == "phone_number_quality_update" or "quality_rating" in val:
                phone_num = val.get("display_phone_number")
                q_rating = val.get("quality_rating")
                if phone_num and q_rating:
                    integ = (
                        db.query(WhatsAppIntegration)
                        .filter(
                            (WhatsAppIntegration.display_phone_number == phone_num)
                            | (WhatsAppIntegration.phone_number_id == str(val.get("phone_number_id", "")))
                        )
                        .first()
                    )
                    if integ:
                        integ.quality_rating = q_rating.upper()
                        db.commit()

    return {"status": "ok"}
