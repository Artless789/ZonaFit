from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from app.core.auth import get_current_user, require_admin
from app.database.database import get_db
from app.models.user import User
from app.schemas.whatsapp import (
    WhatsAppIntegrationConnect,
    WhatsAppIntegrationResponse,
    WhatsAppTestMessageRequest,
    WhatsAppEmbeddedSignupRequest,
    WhatsAppMetaConfigResponse,
)
from app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp Multi-Tenant"],
)


def _get_gym_id(current_user: User) -> int:
    if not current_user.gym_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with a gym",
        )
    return current_user.gym_id


# ── GET Integration (Plural + Singular alias) ─────────────────────────────────

@router.get("/integrations", response_model=WhatsAppIntegrationResponse)
@router.get("/integration", response_model=WhatsAppIntegrationResponse)
def get_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    gym_id = _get_gym_id(current_user)
    integration = WhatsAppService.get_integration(db, gym_id)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active WhatsApp integration found",
        )
    return integration


# ── GET Meta Config (Plural + Singular alias) ─────────────────────────────────

@router.get("/integrations/meta-config", response_model=WhatsAppMetaConfigResponse)
@router.get("/integration/meta-config", response_model=WhatsAppMetaConfigResponse)
def get_meta_config(
    current_user: User = Depends(get_current_user),
):
    _get_gym_id(current_user)
    return WhatsAppService.get_meta_config()


# ── POST Connect manual credentials (Plural + Singular alias) ─────────────────

@router.post("/integrations/connect", response_model=WhatsAppIntegrationResponse)
@router.post("/integration/connect", response_model=WhatsAppIntegrationResponse)
def connect_integration(
    payload: WhatsAppIntegrationConnect,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    gym_id = _get_gym_id(current_user)
    return WhatsAppService.connect_or_update(db, gym_id, payload)


# ── POST Meta Embedded Signup (Plural + Singular alias) ───────────────────────

@router.post("/integrations/embedded-signup", response_model=WhatsAppIntegrationResponse)
@router.post("/integration/embedded-signup", response_model=WhatsAppIntegrationResponse)
def connect_embedded_signup(
    payload: WhatsAppEmbeddedSignupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    gym_id = _get_gym_id(current_user)
    return WhatsAppService.connect_embedded_signup(db, gym_id, payload)


# ── POST Disconnect (Plural + Singular alias) ─────────────────────────────────

@router.post("/integrations/disconnect")
@router.post("/integration/disconnect")
def disconnect_integration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    gym_id = _get_gym_id(current_user)
    WhatsAppService.disconnect(db, gym_id)
    return {"message": "Integración de WhatsApp desconectada exitosamente"}


# ── POST Test Message (Plural + Singular alias) ───────────────────────────────

@router.post("/integrations/test")
@router.post("/integration/test")
def send_test_message(
    payload: WhatsAppTestMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    gym_id = _get_gym_id(current_user)
    try:
        res = WhatsAppService.send_test_message(
            db=db,
            gym_id=gym_id,
            to_phone=payload.to_phone,
            message=payload.message,
        )
        return {"status": "success", "result": res}
    except Exception as e:
        logger.error(f"[WhatsApp] Test message error for gym {gym_id}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

