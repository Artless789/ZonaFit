from typing import Optional, Any
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import or_, cast, String

from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.pagination import PaginationParams
from app.utils.query import paginate, apply_sort
from app.schemas.sort import SortParams
from app.constants.audit_actions import AuditModule, AuditAction


def resolve_module_from_entity(entity_type: str, action: str = "") -> str:
    entity = (entity_type or "").strip().lower()
    act = (action or "").strip().upper()

    if "auth" in entity or act in ("LOGIN", "LOGOUT", "LOGIN_FAILED"):
        return AuditModule.AUTH
    if "client" in entity:
        return AuditModule.CLIENTS
    if "membership" in entity:
        return AuditModule.MEMBERSHIPS
    if "payment" in entity:
        return AuditModule.PAYMENTS
    if "sale" in entity or "credit" in act:
        return AuditModule.SALES
    if "inventory" in entity or "product" in entity:
        return AuditModule.INVENTORY
    if "cash" in entity:
        return AuditModule.CASH_REGISTER
    if "settings" in entity or "gym" in entity:
        return AuditModule.SETTINGS
    if "user" in entity:
        return AuditModule.USERS
    return entity.upper() if entity else "SISTEMA"


def build_default_description(
    action: str,
    entity_type: str,
    user_name: Optional[str] = None,
    entity_name: Optional[str] = None,
    entity_id: Optional[int] = None,
) -> str:
    actor = user_name or "Personal"
    target = entity_name or (f"#{entity_id}" if entity_id else "")

    descriptions = {
        AuditAction.LOGIN: f"{actor} inició sesión en el sistema",
        AuditAction.LOGOUT: f"{actor} cerró sesión en el sistema",
        AuditAction.CLIENT_CREATED: f"{actor} registró al cliente {target}".strip(),
        AuditAction.CLIENT_UPDATED: f"{actor} modificó los datos del cliente {target}".strip(),
        AuditAction.CLIENT_DEACTIVATED: f"{actor} desactivó al cliente {target}".strip(),
        AuditAction.MEMBERSHIP_CREATED: f"{actor} registró una nueva membresía {target}".strip(),
        AuditAction.MEMBERSHIP_RENEWED: f"{actor} renovó la membresía {target}".strip(),
        AuditAction.MEMBERSHIP_CANCELLED: f"{actor} canceló la membresía {target}".strip(),
        AuditAction.MEMBERSHIP_UPDATED: f"{actor} modificó la membresía {target}".strip(),
        AuditAction.PAYMENT_CREATED: f"{actor} registró el pago {target}".strip(),
        AuditAction.PAYMENT_CANCELLED: f"{actor} anuló el pago {target}".strip(),
        AuditAction.SALE_CREATED: f"{actor} registró una venta {target}".strip(),
        AuditAction.CREDIT_SALE_CREATED: f"{actor} registró una venta a crédito {target}".strip(),
        AuditAction.SALE_CANCELLED: f"{actor} canceló la venta {target}".strip(),
        AuditAction.INVENTORY_MOVEMENT: f"{actor} registró movimiento de inventario en {target}".strip(),
        AuditAction.PRODUCT_CREATED: f"{actor} creó el producto {target}".strip(),
        AuditAction.PRODUCT_UPDATED: f"{actor} modificó el producto {target}".strip(),
        AuditAction.PRODUCT_DEACTIVATED: f"{actor} desactivó el producto {target}".strip(),
        AuditAction.CASH_REGISTER_OPENED: f"{actor} realizó la apertura de caja {target}".strip(),
        AuditAction.CASH_REGISTER_CLOSED: f"{actor} realizó el cierre de caja {target}".strip(),
        AuditAction.CASH_MOVEMENT_CREATED: f"{actor} registró movimiento de caja {target}".strip(),
        AuditAction.GYM_SETTINGS_UPDATED: f"{actor} actualizó la configuración del gimnasio",
        AuditAction.USER_CREATED: f"{actor} registró al empleado {target}".strip(),
        AuditAction.USER_UPDATED: f"{actor} modificó los datos del empleado {target}".strip(),
        AuditAction.ROLE_CHANGED: f"{actor} modificó el rol del empleado {target}".strip(),
        AuditAction.USER_DEACTIVATED: f"{actor} desactivó al empleado {target}".strip(),
        AuditAction.USER_ACTIVATED: f"{actor} reactivó al empleado {target}".strip(),
    }

    if action in descriptions:
        return descriptions[action]

    target_info = f" {target}" if target else ""
    return f"{actor} realizó {action} en {entity_type}{target_info}"


class AuditService:

    @staticmethod
    def log(
        db: Session,
        gym_id: int,
        action: str,
        entity_type: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        module: Optional[str] = None,
        entity_id: Optional[int] = None,
        entity_name: Optional[str] = None,
        description: Optional[str] = None,
        status: str = "SUCCESS",
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
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

        # Si user_id está presente pero no user_name, intentar resolverlo
        final_user_name = user_name
        if not final_user_name and user_id:
            try:
                final_user_name = db.query(User.full_name).filter(User.id == user_id).scalar()
            except Exception:
                final_user_name = None

        final_module = module or resolve_module_from_entity(entity_type, action)
        final_description = description or build_default_description(
            action=action,
            entity_type=entity_type,
            user_name=final_user_name,
            entity_name=entity_name,
            entity_id=entity_id,
        )

        entry = AuditLog(
            gym_id=gym_id,
            user_id=user_id,
            user_name=final_user_name,
            action=action,
            module=final_module,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            description=final_description,
            status=status,
            old_values=sanitized_old,
            new_values=sanitized_new,
            ip_address=ip_address,
        )
        db.add(entry)
        db.flush()
        return entry

    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        sort: SortParams,
        params: PaginationParams,
        action: Optional[str] = None,
        module: Optional[str] = None,
        entity_type: Optional[str] = None,
        user_id: Optional[int] = None,
        search: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ):
        query = (
            db.query(AuditLog)
            .filter(AuditLog.gym_id == current_user.gym_id)
        )

        if action and action.upper() != "ALL":
            query = query.filter(AuditLog.action == action.upper())

        if module and module.upper() != "ALL":
            query = query.filter(AuditLog.module == module.upper())

        if entity_type and entity_type.upper() != "ALL":
            query = query.filter(AuditLog.entity_type == entity_type)

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        if start_date:
            query = query.filter(AuditLog.created_at >= start_date)

        if end_date:
            query = query.filter(AuditLog.created_at <= end_date)

        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    AuditLog.description.ilike(search_pattern),
                    AuditLog.entity_name.ilike(search_pattern),
                    AuditLog.user_name.ilike(search_pattern),
                    AuditLog.action.ilike(search_pattern),
                    AuditLog.module.ilike(search_pattern),
                    AuditLog.entity_type.ilike(search_pattern),
                    cast(AuditLog.entity_id, String).ilike(search_pattern),
                    cast(AuditLog.id, String).ilike(search_pattern),
                )
            )

        query = apply_sort(
            query=query,
            sort=sort.sort,
            order=sort.order,
            allowed_fields={
                "created_at": AuditLog.created_at,
                "action": AuditLog.action,
                "module": AuditLog.module,
                "entity_type": AuditLog.entity_type,
                "user_name": AuditLog.user_name,
            },
        )

        if not sort.sort:
            query = query.order_by(AuditLog.created_at.desc())

        paginated = paginate(query=query, params=params)

        # Enriquecer registros históricos que pudieran tener campos nulos
        for item in paginated.items:
            if not item.user_name:
                if item.user and getattr(item.user, "full_name", None):
                    item.user_name = item.user.full_name
                elif item.user_id:
                    item.user_name = f"Usuario #{item.user_id}"
                else:
                    item.user_name = "Sistema / API"

            if not item.module:
                item.module = resolve_module_from_entity(item.entity_type, item.action)

            if not item.description:
                item.description = build_default_description(
                    action=item.action,
                    entity_type=item.entity_type,
                    user_name=item.user_name,
                    entity_name=item.entity_name,
                    entity_id=item.entity_id,
                )

        return paginated

    @staticmethod
    def get_by_id(
        db: Session,
        current_user: User,
        log_id: int,
    ) -> Optional[AuditLog]:
        entry = (
            db.query(AuditLog)
            .filter(
                AuditLog.id == log_id,
                AuditLog.gym_id == current_user.gym_id,
            )
            .first()
        )
        if entry:
            if not entry.user_name:
                if entry.user and getattr(entry.user, "full_name", None):
                    entry.user_name = entry.user.full_name
                elif entry.user_id:
                    entry.user_name = f"Usuario #{entry.user_id}"
                else:
                    entry.user_name = "Sistema / API"
            if not entry.module:
                entry.module = resolve_module_from_entity(entry.entity_type, entry.action)
            if not entry.description:
                entry.description = build_default_description(
                    action=entry.action,
                    entity_type=entry.entity_type,
                    user_name=entry.user_name,
                    entity_name=entry.entity_name,
                    entity_id=entry.entity_id,
                )
        return entry
