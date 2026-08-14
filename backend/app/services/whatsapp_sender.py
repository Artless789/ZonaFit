import json
import os
import urllib.error
import urllib.request
from dotenv import load_dotenv

load_dotenv()


class WhatsAppSender:
    """
    HTTP client for the Meta WhatsApp Business Cloud API.

    Required environment variables (.env):
        WHATSAPP_PHONE_NUMBER_ID  - Phone number ID from Meta Business dashboard.
        WHATSAPP_ACCESS_TOKEN     - Permanent system user access token.

    In development/test environments where these are not configured, every
    send attempt will raise WhatsAppCredentialsNotConfiguredError.
    """

    _PHONE_NUMBER_ID: str | None = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    _ACCESS_TOKEN: str | None = os.getenv("WHATSAPP_ACCESS_TOKEN")
    _API_VERSION: str = "v19.0"
    _TIMEOUT: int = 30

    @classmethod
    def is_configured(cls) -> bool:
        return bool(cls._PHONE_NUMBER_ID and cls._ACCESS_TOKEN)

    @classmethod
    def send_text(cls, to_phone: str, body: str) -> dict:
        """
        Sends a free-form text message to a WhatsApp number.

        Args:
            to_phone: Recipient phone number in E.164 format (e.g. "573001234567").
            body: Plain text message (max 4096 characters per Meta limits).

        Returns:
            dict: Meta API JSON response on success.

        Raises:
            ValueError: If credentials are not configured.
            RuntimeError: If the Meta API returns an error.
        """
        if not cls.is_configured():
            raise ValueError(
                "WhatsApp credentials are not configured. "
                "Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in your .env file."
            )

        url = (
            f"https://graph.facebook.com/{cls._API_VERSION}"
            f"/{cls._PHONE_NUMBER_ID}/messages"
        )

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
                "Authorization": f"Bearer {cls._ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=cls._TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))

        except urllib.error.HTTPError as exc:
            error_body = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"WhatsApp API error {exc.code}: {error_body}"
            ) from exc

        except urllib.error.URLError as exc:
            raise RuntimeError(
                f"WhatsApp API connection error: {exc.reason}"
            ) from exc
