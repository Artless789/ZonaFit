from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional
from fastapi import HTTPException

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.filter import FilterParams
from app.schemas.sort import SortParams
from app.schemas.pagination import PaginationParams
from app.utils.query import apply_sort, paginate
from app.core.security import hash_password, normalize_email
from app.services.audit_service import AuditService

class UserService:
    @staticmethod
    def get_all(
        db: Session,
        current_user: User,
        filters: FilterParams,
        sort: SortParams,
        pagination: PaginationParams,
    ):
        query = db.query(User)
        
        if current_user.role.upper() != "SUPERADMIN":
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
            # If status is "all" or any other unhandled string, do not restrict by is_active

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
        query = db.query(User).filter(User.id == user_id)
        if current_user.role.upper() != "SUPERADMIN":
            query = query.filter(User.gym_id == current_user.gym_id)
        return query.first()

    @staticmethod
    def create(db: Session, current_user: User, user_data: UserCreate) -> User:
        # Check permissions
        if current_user.role.upper() not in ["SUPERADMIN", "OWNER", "ADMIN"]:
            raise ValueError("No tienes permisos para crear usuarios.")
        
        if current_user.role.upper() == "ADMIN" and user_data.role.upper() not in ["STAFF"]:
            raise ValueError("Los administradores solo pueden crear personal (STAFF).")
            
        if user_data.role.upper() == "SUPERADMIN":
             raise ValueError("No puedes crear un superadministrador desde este portal.")

        # Bypass RLS to check for email uniqueness globally, as emails must be unique across the platform
        from sqlalchemy import text
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        normalized_email = normalize_email(user_data.email)
        try:
            existing_user = db.query(User).filter(func.lower(func.trim(User.email)) == normalized_email).first()
            if existing_user:
                raise ValueError("El correo electrónico ya está registrado.")
        finally:
            # ALWAYS restore RLS after global check — prevents bypass leaking via connection pool
            if current_user.role.upper() != "SUPERADMIN":
                db.info.pop('bypass_rls', None)
                db.info['tenant_id'] = current_user.gym_id
                db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
                db.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(current_user.gym_id)})

        new_user = User(
            full_name=user_data.full_name.strip(),
            email=normalized_email,
            password=hash_password(user_data.password),
            role=user_data.role.upper(),
            gym_id=current_user.gym_id if current_user.role.upper() != "SUPERADMIN" else None,
            is_active=True
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # Audit
        if current_user.gym_id:
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action="USER_CREATED",
                entity_type="User",
                entity_id=new_user.id,
                user_id=current_user.id,
                new_values={
                    "full_name": new_user.full_name,
                    "email": new_user.email,
                    "role": new_user.role
                }
            )

        return new_user

    @staticmethod
    def update(db: Session, current_user: User, user: User, user_data: UserUpdate) -> User:
        if current_user.role.upper() not in ["SUPERADMIN", "OWNER", "ADMIN"]:
            raise ValueError("No tienes permisos para modificar usuarios.")

        if current_user.id == user.id and user_data.role and user_data.role.upper() != user.role.upper():
            raise ValueError("No puedes cambiar tu propio rol.")
            
        if current_user.role.upper() == "ADMIN":
            if user.role.upper() in ["OWNER", "SUPERADMIN"]:
                raise ValueError("No puedes modificar a un usuario de mayor jerarquía.")
            if user_data.role and user_data.role.upper() not in ["STAFF"]:
                raise ValueError("No puedes cambiar el rol a niveles superiores a STAFF.")

        if user_data.role and user_data.role.upper() == "SUPERADMIN":
             raise ValueError("No puedes asignar el rol de superadministrador desde este portal.")

        old_values = {
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }

        if user_data.email:
            normalized_email = normalize_email(user_data.email)
            current_normalized = normalize_email(user.email)
            if normalized_email != current_normalized:
                # Global check for email
                from sqlalchemy import text
                db.info['bypass_rls'] = True
                db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
                try:
                    existing_user = db.query(User).filter(func.lower(func.trim(User.email)) == normalized_email).first()
                    if existing_user and existing_user.id != user.id:
                        raise ValueError("El correo electrónico ya está registrado.")
                finally:
                    # ALWAYS restore RLS after global check — prevents bypass leaking via connection pool
                    if current_user.role.upper() != "SUPERADMIN":
                        db.info.pop('bypass_rls', None)
                        db.info['tenant_id'] = current_user.gym_id
                        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))
                        db.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(current_user.gym_id)})

                user.email = normalized_email

        if user_data.full_name is not None:
            user.full_name = user_data.full_name
        if user_data.role is not None:
            user.role = user_data.role.upper()
        if user_data.is_active is not None:
            user.is_active = user_data.is_active

        db.commit()
        db.refresh(user)

        new_values = {
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }

        # Audit
        if current_user.gym_id:
            action = "USER_UPDATED"
            if old_values["role"] != new_values["role"]:
                action = "ROLE_CHANGED"
            elif old_values["is_active"] != new_values["is_active"]:
                action = "USER_DEACTIVATED" if not new_values["is_active"] else "USER_ACTIVATED"
                
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=action,
                entity_type="User",
                entity_id=user.id,
                user_id=current_user.id,
                old_values=old_values,
                new_values=new_values
            )

        return user
