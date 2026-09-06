import json
import logging
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.encryption import encrypt_token
from app.models.whatsapp_integration import WhatsAppIntegration
from app.schemas.whatsapp import (
    WhatsAppIntegrationConnect,
    WhatsAppEmbeddedSignupRequest,
    WhatsAppMetaConfigResponse,
)
from app.services.whatsapp_sender import WhatsAppSender

logger = logging.getLogger(__name__)


class WhatsAppService:
    @staticmethod
    def get_integration(db: Session, gym_id: int) -> Optional[WhatsAppIntegration]:
        return (
            db.query(WhatsAppIntegration)
            .filter(
                WhatsAppIntegration.gym_id == gym_id,
                WhatsAppIntegration.is_active.is_(True),
            )
            .first()
        )

    @staticmethod
    def get_meta_config() -> WhatsAppMetaConfigResponse:
        app_id = settings.META_APP_ID.strip() if settings.META_APP_ID else None
        config_id = settings.META_CONFIG_ID.strip() if settings.META_CONFIG_ID else None
        api_version = settings.META_GRAPH_API_VERSION or 'v22.0'
        is_ready = bool(app_id and config_id)

        return WhatsAppMetaConfigResponse(
            app_id=app_id,
            config_id=config_id,
            api_version=api_version,
            is_configured=is_ready,
        )

    @classmethod
    def connect_or_update(
        cls,
        db: Session,
        gym_id: int,
        payload: WhatsAppIntegrationConnect,
    ) -> WhatsAppIntegration:
        if not payload.phone_number_id or not payload.access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='phone_number_id y access_token son requeridos',
            )

        encrypted_token = encrypt_token(payload.access_token)
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        other_active = (
            db.query(WhatsAppIntegration)
            .filter(
                WhatsAppIntegration.gym_id == gym_id,
                WhatsAppIntegration.phone_number_id != payload.phone_number_id,
                WhatsAppIntegration.is_active.is_(True),
            )
            .all()
        )
        for other in other_active:
            other.is_active = False
            other.status = 'DISCONNECTED'
            other.updated_at = now

        existing = (
            db.query(WhatsAppIntegration)
            .filter(
                WhatsAppIntegration.gym_id == gym_id,
                WhatsAppIntegration.phone_number_id == payload.phone_number_id,
            )
            .first()
        )

        if existing:
            existing.access_token_encrypted = encrypted_token
            existing.waba_id = payload.waba_id or existing.waba_id
            existing.business_id = payload.business_id or existing.business_id
            existing.display_phone_number = payload.display_phone_number or existing.display_phone_number
            existing.verified_name = payload.verified_name or existing.verified_name
            existing.is_active = True
            existing.status = 'CONNECTED'
            existing.last_error = None
            existing.updated_at = now
            db.commit()
            db.refresh(existing)
            logger.info(f'[WhatsApp] Updated integration {existing.id} for gym {gym_id}')
            return existing

        new_integration = WhatsAppIntegration(
            gym_id=gym_id,
            phone_number_id=payload.phone_number_id,
            access_token_encrypted=encrypted_token,
            waba_id=payload.waba_id,
            business_id=payload.business_id,
            display_phone_number=payload.display_phone_number,
            verified_name=payload.verified_name,
            status='CONNECTED',
            quality_rating='UNKNOWN',
            is_active=True,
            connected_at=now,
            updated_at=now,
        )
        db.add(new_integration)
        db.commit()
        db.refresh(new_integration)
        logger.info(f'[WhatsApp] Created new integration {new_integration.id} for gym {gym_id}')
        return new_integration

    @classmethod
    def connect_embedded_signup(
        cls,
        db: Session,
        gym_id: int,
        payload: WhatsAppEmbeddedSignupRequest,
    ) -> WhatsAppIntegration:
        app_id = settings.META_APP_ID.strip() if settings.META_APP_ID else None
        app_secret = settings.META_APP_SECRET.strip() if settings.META_APP_SECRET else None
        api_version = settings.META_GRAPH_API_VERSION or 'v22.0'

        if not app_id or not app_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    'Meta App ID o App Secret no estan configurados en el servidor. '
                    'Configura META_APP_ID y META_APP_SECRET en el entorno para habilitar Embedded Signup.'
                ),
            )

        if not payload.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='El codigo de autorizacion de Meta (code) es requerido',
            )

        token_url = (
            f'https://graph.facebook.com/{api_version}/oauth/access_token?'
            f'client_id={app_id}&client_secret={app_secret}&code={payload.code}'
        )

        try:
            req = urllib.request.Request(token_url, method='GET')
            with urllib.request.urlopen(req, timeout=20) as resp:
                token_data = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode('utf-8', errors='replace')
            logger.error(f'[WhatsApp Embedded Signup] Meta OAuth error {exc.code}: {err_body}')
            try:
                err_json = json.loads(err_body)
                msg = err_json.get('error', {}).get('message', err_body)
            except Exception:
                msg = err_body
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f'Error en Meta OAuth: {msg}',
            )
        except Exception as exc:
            logger.error(f'[WhatsApp Embedded Signup] Connection error: {exc}')
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail='No fue posible comunicarse con los servidores de Meta',
            )

        access_token = token_data.get('access_token')
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Meta no retorno un token de acceso valido',
            )

        # Upgrade short-lived token (~1-2h) to long-lived token (60 days) via fb_exchange_token
        try:
            exchange_url = (
                f'https://graph.facebook.com/{api_version}/oauth/access_token?'
                f'grant_type=fb_exchange_token&client_id={app_id}&client_secret={app_secret}&fb_exchange_token={access_token}'
            )
            ex_req = urllib.request.Request(exchange_url, method='GET')
            with urllib.request.urlopen(ex_req, timeout=15) as ex_resp:
                ex_data = json.loads(ex_resp.read().decode('utf-8'))
                long_lived_token = ex_data.get('access_token')
                if long_lived_token:
                    access_token = long_lived_token
                    logger.info(f'[WhatsApp Embedded Signup] Successfully upgraded to long-lived access token for gym {gym_id}')
        except Exception as exc:
            logger.warning(f'[WhatsApp Embedded Signup] Long-lived token exchange notice: {exc}')

        # Gym's individual access token (strictly scoped to this gym's authorization)
        gym_token = access_token

        phone_number_id = payload.phone_number_id
        waba_id = payload.waba_id
        business_id = payload.business_id
        display_phone_number = None
        verified_name = None
        quality_rating = 'UNKNOWN'

        if not phone_number_id and waba_id:
            try:
                waba_url = f'https://graph.facebook.com/{api_version}/{waba_id}/phone_numbers'
                waba_req = urllib.request.Request(
                    waba_url,
                    headers={'Authorization': f'Bearer {gym_token}'},
                    method='GET',
                )
                with urllib.request.urlopen(waba_req, timeout=15) as resp:
                    phones_data = json.loads(resp.read().decode('utf-8'))
                    phone_items = phones_data.get('data', [])
                    if phone_items:
                        phone_number_id = phone_items[0].get('id')
                        display_phone_number = phone_items[0].get('display_phone_number')
                        verified_name = phone_items[0].get('verified_name')
                        quality_rating = phone_items[0].get('quality_rating', 'UNKNOWN')
            except Exception as e:
                logger.warning(f'[WhatsApp Embedded Signup] Could not fetch phone numbers from WABA: {e}')

        if phone_number_id and not display_phone_number:
            try:
                phone_url = f'https://graph.facebook.com/{api_version}/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating'
                phone_req = urllib.request.Request(
                    phone_url,
                    headers={'Authorization': f'Bearer {gym_token}'},
                    method='GET',
                )
                with urllib.request.urlopen(phone_req, timeout=15) as resp:
                    phone_info = json.loads(resp.read().decode('utf-8'))
                    display_phone_number = phone_info.get('display_phone_number')
                    verified_name = phone_info.get('verified_name')
                    quality_rating = phone_info.get('quality_rating', 'UNKNOWN')
            except Exception as e:
                logger.warning(f'[WhatsApp Embedded Signup] Could not fetch phone details: {e}')

        if not phone_number_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='No se pudo identificar el phone_number_id de WhatsApp de la cuenta de Meta',
            )

        # Auto-subscribe app to WABA webhooks (administrative onboarding call).
        # Uses platform administrative token if configured; otherwise the gym's authorized token.
        # This platform token is NEVER stored in the gym's integration record.
        if waba_id:
            admin_token = settings.META_SYSTEM_USER_TOKEN.strip() if settings.META_SYSTEM_USER_TOKEN else gym_token
            try:
                sub_url = f'https://graph.facebook.com/{api_version}/{waba_id}/subscribed_apps'
                sub_req = urllib.request.Request(
                    sub_url,
                    headers={'Authorization': f'Bearer {admin_token}'},
                    method='POST',
                )
                with urllib.request.urlopen(sub_req, timeout=10) as _:
                    logger.info(f'[WhatsApp Embedded Signup] Auto-subscribed webhooks for WABA {waba_id}')
            except Exception as e:
                logger.warning(f'[WhatsApp Embedded Signup] Could not auto-subscribe WABA to webhooks: {e}')

        # Multi-tenant credential storage:
        # Strictly store the gym's individual token (encrypted with Fernet).
        # Platform administrative tokens are NEVER saved into the gym's database record.
        connect_payload = WhatsAppIntegrationConnect(
            phone_number_id=phone_number_id,
            access_token=gym_token,
            waba_id=waba_id,
            business_id=business_id,
            display_phone_number=display_phone_number,
            verified_name=verified_name,
        )

        integration = cls.connect_or_update(db, gym_id, connect_payload)
        integration.quality_rating = quality_rating
        db.commit()
        db.refresh(integration)
        return integration

    @staticmethod
    def disconnect(db: Session, gym_id: int) -> bool:
        integrations = (
            db.query(WhatsAppIntegration)
            .filter(
                WhatsAppIntegration.gym_id == gym_id,
                WhatsAppIntegration.is_active.is_(True),
            )
            .all()
        )
        if not integrations:
            return False

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        for integ in integrations:
            integ.is_active = False
            integ.status = 'DISCONNECTED'
            integ.updated_at = now

        db.commit()
        logger.info(f'[WhatsApp] Disconnected {len(integrations)} integrations for gym {gym_id}')
        return True

    @staticmethod
    def send_test_message(
        db: Session,
        gym_id: int,
        to_phone: str,
        message: Optional[str] = None,
    ) -> dict:
        return WhatsAppSender.send_text(
            to_phone=to_phone,
            body=message or 'Mensaje de prueba desde Merwil ZonaFit',
            db=db,
            gym_id=gym_id,
        )
