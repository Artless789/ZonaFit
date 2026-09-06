import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.is_development = settings.ENVIRONMENT.lower() in ("dev", "development")

    def _build_reset_email_html(self, reset_url: str) -> str:
        return f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2196F3;">ZONA<span style="color: #0d47a1;">FIT</span></h1>
            </div>
            <h2 style="color: #333;">Recuperación de contraseña</h2>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Haz clic en el siguiente botón para crear una nueva contraseña. El enlace expira en
            <strong>{settings.TOKEN_EXPIRATION_MINUTES} minutos</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="{reset_url}"
                 style="background-color: #2196F3; color: white; padding: 14px 28px;
                        text-decoration: none; border-radius: 8px; font-weight: bold;
                        display: inline-block;">
                Restablecer contraseña
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              Si no solicitaste este cambio, puedes ignorar este correo con seguridad.
              Tu contraseña no será modificada.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <a href="{reset_url}" style="color: #2196F3; word-break: break-all;">{reset_url}</a>
            </p>
          </body>
        </html>
        """

    def send_password_reset_email(self, to_email: str, reset_url: str) -> bool:
        """
        Envía un correo de recuperación de contraseña.
        En desarrollo sin SMTP configurado, imprime la URL en consola (no lanza excepción).
        En producción sin SMTP configurado, lanza RuntimeError para que el endpoint lo capture.
        """
        smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)

        if not smtp_configured:
            if self.is_development:
                logger.warning("=" * 60)
                logger.warning(f"[DEV MODE] Simulación de Email para: {to_email}")
                logger.warning(f"URL de Recuperación: {reset_url}")
                logger.warning("=" * 60)
                return True
            else:
                # Producción sin SMTP → error explícito, no silencioso
                raise RuntimeError("SMTP no configurado en entorno de producción. Correo no enviado.")

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "Recuperación de contraseña - ZonaFit"
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            html_body = self._build_reset_email_html(reset_url)
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

            logger.info(f"Password reset email sent to {to_email}")
            return True

        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending password reset email to {to_email}: {e}")
            raise RuntimeError(f"Error al enviar el correo de recuperación: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error sending password reset email to {to_email}: {e}")
            raise RuntimeError(f"Error inesperado al enviar el correo de recuperación.") from e


email_service = EmailService()
