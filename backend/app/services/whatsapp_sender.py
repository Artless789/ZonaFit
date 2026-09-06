import json
import os
import urllib.error
import urllib.request
import logging
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_token

load_dotenv()
logger = logging.getLogger(__name__)


class WhatsAppSender:
    """
    HTTP client for the Meta WhatsApp Business Cloud API.
    Supports multi-tenant credentials per gym via WhatsAppIntegration,
    with fallback to global environment variables.
    """

    _PHONE_NUMBER_ID: str | None = None
    _ACCESS_TOKEN: str | None = None
    _API_VERSION: str = "v22.0"
    _TIMEOUT: int = 30

    @classmethod
    def get_phone_number_id(cls) -> str | None:
        return os.getenv("WHATSAPP_PHONE_NUMBER_ID") or cls._PHONE_NUMBER_ID

    @classmethod
    def get_access_token(cls) -> str | None:
        return os.getenv("WHATSAPP_ACCESS_TOKEN") or cls._ACCESS_TOKEN

    @classmethod
    def get_api_version(cls) -> str:
        return (
            os.getenv("META_GRAPH_API_VERSION")
            or os.getenv("WHATSAPP_API_VERSION")
            or cls._API_VERSION
        )

    @classmethod
    def is_configured(cls, db: Optional[Session] = None, gym_id: Optional[int] = None) -> bool:
        if db is not None and gym_id is not None:
            from app.models.whatsapp_integration import WhatsAppIntegration
            integration = (
                db.query(WhatsAppIntegration)
                .filter(
                    WhatsAppIntegration.gym_id == gym_id,
                    WhatsAppIntegration.is_active == True,
                )
                .first()
            )
            if integration and integration.phone_number_id and integration.access_token_encrypted:
                return True
            return False
        return bool(cls.get_phone_number_id() and cls.get_access_token())

    @classmethod
    def get_credentials(
        cls,
        db: Optional[Session] = None,
        gym_id: Optional[int] = None,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> tuple[str, str, Optional[int]]:
        """
        Resolves (phone_number_id, access_token, integration_id) prioritizing:
        1. Explicitly passed credentials.
        2. Database WhatsAppIntegration for gym_id.
        3. Environment variables (ONLY when gym_id is None).
        """
        if phone_number_id and access_token:
            return phone_number_id, access_token, None

        integration_id = None
        if db is not None and gym_id is not None:
            try:
                from app.models.whatsapp_integration import WhatsAppIntegration
                integration = (
                    db.query(WhatsAppIntegration)
                    .filter(
                        WhatsAppIntegration.gym_id == gym_id,
                        WhatsAppIntegration.is_active == True,
                    )
                    .first()
                )
                if integration and integration.phone_number_id and integration.access_token_encrypted:
                    decrypted = decrypt_token(integration.access_token_encrypted)
                    if decrypted:
                        return integration.phone_number_id, decrypted, integration.id
            except Exception as e:
                logger.warning(f"Error fetching WhatsApp integration for gym {gym_id}: {e}")

            # STRICT MULTI-TENANT ISOLATION:
            # If gym_id is specified, operations MUST use that gym's individual integration.
            # Platform tokens (e.g. META_SYSTEM_USER_TOKEN) or global environment credentials
            # MUST NEVER substitute a missing or inactive gym integration.
            raise ValueError(
                f"WhatsApp credentials are not configured for gym {gym_id}. "
                "The gym must connect its own WhatsApp integration in settings."
            )

        # Fallback to env ONLY when gym_id is None (e.g. standalone scripts or CLI without tenant context)
        env_phone_id = cls.get_phone_number_id()
        env_token = cls.get_access_token()
        if env_phone_id and env_token:
            return env_phone_id, env_token, None

        raise ValueError(
            "WhatsApp credentials are not configured. "
            "Connect WhatsApp in gym settings or configure WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
        )

    @classmethod
    def send_text(
        cls,
        to_phone: str,
        body: str,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
        db: Optional[Session] = None,
        gym_id: Optional[int] = None,
    ) -> dict:
        """
        Sends a free-form text message to a WhatsApp number.
        """
        phone_id, token, integration_id = cls.get_credentials(
            db=db,
            gym_id=gym_id,
            phone_number_id=phone_number_id,
            access_token=access_token,
        )
        api_version = cls.get_api_version()

        url = f"https://graph.facebook.com/{api_version}/{phone_id}/messages"

        payload = json.dumps({
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": body},
        }).encode("utf-8")

        req = urllib.request.Request(
            url=url,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=cls._TIMEOUT) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                if integration_id:
                    res_data["_integration_id"] = integration_id
                return res_data

        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"WhatsApp API error {exc.code}: {error_body}"
            ) from exc

        except urllib.error.URLError as exc:
            raise RuntimeError(
                f"WhatsApp API connection error: {exc.reason}"
            ) from exc
