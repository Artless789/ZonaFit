import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.gym_settings import GymSettings
from app.models.notification import Notification
from app.models.notification_template import NotificationTemplate
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.communication import (
    CommunicationPrepareRequest,
    CommunicationPrepareResponse,
    CommunicationRecordOpenedRequest,
    CommunicationRecordOpenedResponse,
)
from app.services.notification_service import (
    normalize_phone_co,
    is_valid_phone,
    _SafeFormatMap,
)

logger = logging.getLogger(__name__)

DEFAULT_TEMPLATES = {
    "MEMBERSHIP_EXPIRY": (
        "Hola {client_name} 👋\n\n"
        "Te recordamos que tu membresía en {gym_name} está próxima a vencer.\n\n"
        "Tu membresía vence el {expiry_date}.\n\n"
        "¡Te esperamos para seguir entrenando! 💪"
    ),
    "MEMBERSHIP_EXPIRED": (
        "Hola {client_name} 👋\n\n"
        "Te informamos que tu membresía en {gym_name} se encuentra vencida.\n\n"
        "Si deseas continuar entrenando con nosotros, acércate a recepción o contáctanos para reactivar tu plan. 💪"
    ),
    "CREDIT_OVERDUE": (
        "Hola {client_name} 👋\n\n"
        "Te recordamos que tienes un saldo pendiente en {gym_name}.\n\n"
        "Valor pendiente: {amount}\n\n"
        "Si necesitas ayuda o consultar tu estado de cuenta, no dudes en comunicarte con nosotros."
    ),
    "PAYMENT_RECEIVED": (
        "Hola {client_name} 👋\n\n"
        "Hemos registrado correctamente tu pago en {gym_name}.\n\n"
        "Concepto:\n"
        "{payment_concept}\n\n"
        "Valor:\n"
        "{amount}\n\n"
        "¡Gracias por confiar en nosotros! 💪"
    ),
    "GROUP_INVITATION": (
        "Hola {client_name} 👋\n\n"
        "¡Bienvenido a {gym_name}!\n\n"
        "Tenemos un grupo de WhatsApp para mantenerte informado sobre horarios, novedades y actividades.\n\n"
        "Puedes unirte mediante este enlace:\n\n"
        "{group_invite_url}\n\n"
        "¡Te esperamos! 💪"
    ),
    "WELCOME": (
        "Hola {client_name} 👋\n\n"
        "¡Bienvenido a {gym_name}!\n\n"
        "Estamos muy felices de tenerte con nosotros. ¡A darlo todo! 💪"
    ),
    "GENERAL": (
        "Hola {client_name} 👋\n\n"
        "Te saludamos desde {gym_name}. Esperamos que estés teniendo un excelente día."
    ),
}


class CommunicationService:
    @staticmethod
    def prepare_message(
        db: Session,
        current_user: User,
        request: CommunicationPrepareRequest,
    ) -> CommunicationPrepareResponse:
        if not current_user.gym_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not associated with a gym",
            )

        client = (
            db.query(Client)
            .filter(
                Client.id == request.client_id,
                Client.gym_id == current_user.gym_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado en este gimnasio.",
            )

        raw_phone = client.phone or ""
        normalized_phone = normalize_phone_co(raw_phone) if raw_phone else ""

        # Retrieve gym name
        gym_settings = (
            db.query(GymSettings)
            .filter(GymSettings.gym_id == current_user.gym_id)
            .first()
        )
        gym_name = "ZonaFit"
        if gym_settings:
            gym_name = gym_settings.trade_name or gym_settings.legal_name or "ZonaFit"

        group_url = ""
        if client.whatsapp_group and client.whatsapp_group.invite_url:
            group_url = client.whatsapp_group.invite_url

        payment_concept = "Mensualidad / Servicios"
        if request.context_data and "payment_concept" in request.context_data:
            payment_concept = request.context_data["payment_concept"]
        elif request.context_data and "detail" in request.context_data:
            payment_concept = request.context_data["detail"]

        # Build context
        context: Dict[str, Any] = {
            "client_name": client.full_name,
            "nombre": client.full_name,
            "gym_name": gym_name,
            "gimnasio": gym_name,
            "expiry_date": "pronto",
            "amount": "$0",
            "detail": payment_concept,
            "payment_concept": payment_concept,
            "group_invite_url": group_url,
            **(request.context_data or {}),
        }

        # Resolve template: look for custom template in notification_templates
        template = (
            db.query(NotificationTemplate)
            .filter(
                NotificationTemplate.gym_id == current_user.gym_id,
                NotificationTemplate.event_type == request.event_type,
                NotificationTemplate.channel.in_(["WHATSAPP_WEB", "WHATSAPP"]),
                NotificationTemplate.is_active.is_(True),
            )
            .first()
        )

        if template and template.template_body:
            body_template = template.template_body
        else:
            body_template = DEFAULT_TEMPLATES.get(
                request.event_type,
                DEFAULT_TEMPLATES["GENERAL"],
            )

        rendered_message = body_template.format_map(_SafeFormatMap(context))

        return CommunicationPrepareResponse(
            client_id=client.id,
            client_name=client.full_name,
            phone=normalized_phone,
            raw_phone=raw_phone,
            rendered_message=rendered_message,
            event_type=request.event_type,
            channel="WHATSAPP_WEB",
        )

    @staticmethod
    def record_opened(
        db: Session,
        current_user: User,
        request: CommunicationRecordOpenedRequest,
    ) -> CommunicationRecordOpenedResponse:
        if not current_user.gym_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not associated with a gym",
            )

        client = (
            db.query(Client)
            .filter(
                Client.id == request.client_id,
                Client.gym_id == current_user.gym_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cliente no encontrado en este gimnasio.",
            )

        normalized_phone = normalize_phone_co(request.recipient)

        notification = Notification(
            gym_id=current_user.gym_id,
            client_id=request.client_id,
            event_type=request.event_type,
            channel="WHATSAPP_WEB",
            recipient=normalized_phone,
            message_body=request.message_body,
            status="OPENED",
            sent_at=datetime.now(timezone.utc),
            delivery_status="OPENED",
        )
        db.add(notification)

        audit = AuditLog(
            gym_id=current_user.gym_id,
            user_id=current_user.id,
            action="WHATSAPP_WEB_OPENED",
            entity_type="Communication",
            entity_id=request.client_id,
            new_values={
                "event_type": request.event_type,
                "recipient": normalized_phone,
            },
        )
        db.add(audit)

        db.commit()
        db.refresh(notification)

        return CommunicationRecordOpenedResponse(
            success=True,
            notification_id=notification.id,
        )
