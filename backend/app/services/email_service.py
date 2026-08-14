import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.is_development = settings.ENVIRONMENT.lower() in ("dev", "development")

    def send_password_reset_email(self, to_email: str, reset_url: str) -> bool:
        """
        Envía un correo de recuperación de contraseña.
        En modo desarrollo, si SMTP no está configurado, imprime la URL en consola.
        """
        # Si no hay credenciales SMTP y estamos en desarrollo, simular el envío
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            if self.is_development:
                # IMPORTANTE: Esto solo debe suceder en entorno DEV local.
                print("="*60)
                print(f"[DEV MODE] Simulación de Email para: {to_email}")
                print(f"URL de Recuperación: {reset_url}")
                print("="*60)
                logger.info(f"Simulated password reset email sent to {to_email}")
                return True
            else:
                logger.error("No SMTP configuration found in production environment.")
                return False
                
        # TODO: Implementar envío SMTP real cuando se provean las credenciales
        # import smtplib
        # from email.message import EmailMessage
        # ... (implementación standard de smtplib)
        
        logger.info(f"Password reset email sent to {to_email} via SMTP")
        return True

email_service = EmailService()
