import os
import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.security import SECRET_KEY

def _get_fernet_key() -> bytes:
    key_src = os.getenv("WHATSAPP_ENCRYPTION_KEY") or SECRET_KEY or "zonafit_whatsapp_master_secret_key_32_bytes"
    digest = hashlib.sha256(key_src.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt_token(token: str) -> str:
    if not token:
        return ""
    f = Fernet(_get_fernet_key())
    return f.encrypt(token.encode("utf-8")).decode("utf-8")

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""
    f = Fernet(_get_fernet_key())
    return f.decrypt(encrypted_token.encode("utf-8")).decode("utf-8")
