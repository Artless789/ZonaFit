from typing import Optional, Any

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.pagination import PaginationParams
from app.utils.query import paginate, apply_sort
from app.schemas.sort import SortParams


class AuditService:

    @staticmethod
    def log(
        db: Session,
        gym_id: int,
        action: str,
        entity_type: str,
        user_id: Optional[int] = None,
        entity_id: Optional[int] = None,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        # Sanitización de datos sensibles
        SENSITIVE_KEYS = {
            "password", "password_hash", "token", "access_token", 
            "refresh_token", "secret", "api_key", "private_key",
            "wompi_private_key", "whatsapp_access_token", "wompi_events_secret",
            "wompi_integrity_secret", "signature", "cvv", "card_number", "smtp_password"
        }

        def sanitize_dict(d: Optional[dict]) -> Optional[dict]:
            if not isinstance(d, dict):
                return d
            sanitized = {}
            for k, v in d.items():
                if any(sensitive in k.lower() for sensitive in SENSITIVE_KEYS):
                    sanitized[k] = "[REDACTED]"
                elif isinstance(v, dict):
                    sanitized[k] = sanitize_dict(v)
                else:
                    sanitized[k] = v
            return sanitized

        sanitized_old = sanitize_dict(old_values)
        sanitized_new = sanitize_dict(new_values)

        entry = AuditLog(
            gym_id=gym_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=sanitized_old,
            new_values=sanitized_new,
            ip_address=ip_address,
        )
        db.add(entry)

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        sort: SortParams,
        params: PaginationParams,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        user_id: Optional[int] = None,
    ):
        query = (
            db.query(AuditLog)
            .filter(AuditLog.gym_id == current_user.gym_id)
        )

        if action:
            query = query.filter(AuditLog.action == action.upper())

        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "created_at": AuditLog.created_at,
                "action": AuditLog.action,
                "entity_type": AuditLog.entity_type,
            },
        )

        if not sort.sort:
            query = query.order_by(AuditLog.created_at.desc())

        return paginate(query=query, params=params)

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        log_id: int,
    ) -> Optional[AuditLog]:
        return (
            db.query(AuditLog)
            .filter(
                AuditLog.id == log_id,
                AuditLog.gym_id == current_user.gym_id,
            )
            .first()
        )
