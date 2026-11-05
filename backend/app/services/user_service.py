from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams
from app.utils.query import apply_sort, paginate
from app.core.security import hash_password, normalize_email
from app.services.audit_service import AuditService
from app.constants.permissions import Role, Permission, user_has_permission


class UserService:
    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        pagination: PaginationParams,
    ):
        if not user_has_permission(current_user, Permission.MANAGE_USERS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes autorización para consultar la lista de personal.",
            )

        query = db.query(User)

        if current_user.role.upper() != Role.SUPERADMIN:
            query = query.filter(User.gym_id == current_user.gym_id)

        search_val = getattr(filters, "search", None)
        if search_val:
            search_term = f"%{search_val}%"
            query = query.filter(
                or_(
                    User.full_name.ilike(search_term),
                    User.email.ilike(search_term)
                )
            )

        status_val = getattr(filters, "status", None)
        if status_val:
            status_clean = str(status_val).lower().strip()
            if status_clean in ("active", "activo", "true", "1"):
                query = query.filter(User.is_active == True)
            elif status_clean in ("inactive", "inactivo", "false", "0"):
                query = query.filter(User.is_active == False)

        allowed_sort_fields = {
            "id": User.id,
            "full_name": User.full_name,
            "email": User.email,
            "role": User.role,
        }

        sort_by = getattr(sort, "sort_by", None) or getattr(sort, "sort", None)
        sort_desc = getattr(sort, "sort_desc", None)
        if sort_desc is None:
            sort_desc = (getattr(sort, "order", "asc") or "asc").lower() == "desc"

        if sort_by and sort_by in allowed_sort_fields:
            sort_column = allowed_sort_fields[sort_by]
            if sort_desc:
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(User.id.desc())

        return paginate(query, pagination)

    @staticmethod
    def get_by_id(db: Session, current_user: User, user_id: int) -> Optional[User]:
        if not user_has_permission(current_user, Permission.MANAGE_USERS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes autorización para consultar datos de personal.",
            )

        query = db.query(User).filter(User.id == user_id)
        if current_user.role.upper() != Role.SUPERADMIN:
            query = query.filter(User.gym_id == current_user.gym_id)
        return query.first()

    @staticmethod
    def create(db: Session, current_user: User, user_data: UserCreate) -> User:
        caller_role = (current_user.role or "").upper()
        if not user_has_permission(current_user, Permission.MANAGE_USERS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para crear usuarios.",
            )

        target_role = (user_data.role or "").upper()

        if caller_role == Role.ADMIN and target_role not in (Role.STAFF, Role.EMPLOYEE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Los administradores solo pueden crear personal operativo (STAFF/EMPLOYEE).",
            )

        if caller_role == Role.ADMIN and user_data.permissions is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo el propietario puede asignar permisos personalizados.",
            )

        if target_role in (Role.SUPERADMIN, Role.OWNER) and caller_role != Role.SUPERADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes crear usuarios con rol OWNER o SUPERADMIN.",
            )

        # Global email check
        from sqlalchemy import text
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        normalized_email = normalize_email(user_data.email)
        try:
            existing_user = db.query(User).filter(func.lower(func.trim(User.email)) == normalized_email).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo electrónico ya está registrado.",
                )
        finally:
            if caller_role != Role.SUPERADMIN:
                db.info.pop('bypass_rls', None)
                db.info['tenant_id'] = current_user.gym_id
                db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
                db.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(current_user.gym_id)})

        new_user = User(
            full_name=user_data.full_name.strip(),
            email=normalized_email,
            password=hash_password(user_data.password),
            role=target_role,
            permissions=user_data.permissions if caller_role in (Role.OWNER, Role.SUPERADMIN) else None,
            gym_id=current_user.gym_id if caller_role != Role.SUPERADMIN else None,
            is_active=True,
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Audit
        if current_user.gym_id:
            from app.constants.audit_actions import AuditAction, AuditModule
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=AuditAction.USER_CREATED,
                module=AuditModule.USERS,
                entity_type="User",
                entity_id=new_user.id,
                entity_name=new_user.full_name,
                user_id=current_user.id,
                user_name=current_user.full_name,
                description=f"{current_user.full_name} registró al empleado {new_user.full_name} con rol {new_user.role}",
                new_values={
                    "full_name": new_user.full_name,
                    "email": new_user.email,
                    "role": new_user.role,
                    "permissions": new_user.permissions,
                },
            )

        return new_user

    @staticmethod
    def update(db: Session, current_user: User, user: User, user_data: UserUpdate) -> User:
        caller_role = (current_user.role or "").upper()
        if not user_has_permission(current_user, Permission.MANAGE_USERS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para modificar usuarios.",
            )

        # Multi-tenant isolation check
        if caller_role != Role.SUPERADMIN and user.gym_id != current_user.gym_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes modificar usuarios de otro gimnasio.",
            )

        # Prevent changing own role or own permissions
        if current_user.id == user.id:
            if user_data.role and user_data.role.upper() != user.role.upper():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No puedes cambiar tu propio rol.",
                )
            if user_data.permissions is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No puedes modificar tus propios permisos.",
                )

        if caller_role == Role.ADMIN:
            if user.role.upper() in (Role.OWNER, Role.SUPERADMIN):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No puedes modificar a un usuario de mayor jerarquía.",
                )
            if user_data.role and user_data.role.upper() not in (Role.STAFF, Role.EMPLOYEE):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No puedes cambiar el rol a niveles superiores a STAFF.",
                )
            if user_data.permissions is not None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo el propietario puede asignar permisos personalizados.",
                )

        if user_data.role and user_data.role.upper() in (Role.SUPERADMIN, Role.OWNER) and caller_role != Role.SUPERADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes asignar el rol de OWNER o SUPERADMIN.",
            )

        old_values = {
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "permissions": user.permissions,
            "is_active": user.is_active,
        }

        if user_data.email:
            normalized_email = normalize_email(user_data.email)
            current_normalized = normalize_email(user.email)
            if normalized_email != current_normalized:
                from sqlalchemy import text
                db.info['bypass_rls'] = True
                db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
                try:
                    existing_user = db.query(User).filter(func.lower(func.trim(User.email)) == normalized_email).first()
                    if existing_user and existing_user.id != user.id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="El correo electrónico ya está registrado.",
                        )
                finally:
                    if caller_role != Role.SUPERADMIN:
                        db.info.pop('bypass_rls', None)
                        db.info['tenant_id'] = current_user.gym_id
                        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
                        db.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(current_user.gym_id)})

                user.email = normalized_email

        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        if user_data.role is not None:
            user.role = user_data.role.upper()
        if user_data.permissions is not None and caller_role in (Role.OWNER, Role.SUPERADMIN):
            user.permissions = user_data.permissions
        if user_data.is_active is not None:
            user.is_active = user_data.is_active

        db.commit()
        db.refresh(user)

        new_values = {
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "permissions": user.permissions,
            "is_active": user.is_active,
        }

        # Audit
        if current_user.gym_id:
            from app.constants.audit_actions import AuditAction, AuditModule
            action = AuditAction.USER_UPDATED
            desc = f"{current_user.full_name} modificó los datos del empleado {user.full_name}"
            if old_values["role"] != new_values["role"]:
                action = AuditAction.ROLE_CHANGED
                desc = f"{current_user.full_name} cambió el rol de {user.full_name} de {old_values['role']} a {new_values['role']}"
            elif old_values["is_active"] != new_values["is_active"]:
                if not new_values["is_active"]:
                    action = AuditAction.USER_DEACTIVATED
                    desc = f"{current_user.full_name} desactivó la cuenta de {user.full_name}"
                else:
                    action = AuditAction.USER_ACTIVATED
                    desc = f"{current_user.full_name} reactivó la cuenta de {user.full_name}"

            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=action,
                module=AuditModule.USERS,
                entity_type="User",
                entity_id=user.id,
                entity_name=user.full_name,
                user_id=current_user.id,
                user_name=current_user.full_name,
                description=desc,
                old_values=old_values,
                new_values=new_values,
            )

        return user
