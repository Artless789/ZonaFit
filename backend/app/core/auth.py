from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import verify_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = verify_access_token(token)
    if not payload or "user_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado."
        )

    # Set RLS Context for the current database session
    from sqlalchemy import text
    role = payload.get("role", "").upper()
    gym_id = payload.get("gym_id")

    if role == "SUPERADMIN":
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
    elif gym_id:
        db.info['tenant_id'] = gym_id
        db.execute(text("SELECT set_config('app.current_gym_id', :gym_id, true)"), {"gym_id": str(gym_id)})

    user = (
        db.query(User)
        .filter(User.id == payload["user_id"])
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado."
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado."
        )

    return user

def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() != "SUPERADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires platform admin privileges.")
    return current_user

def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() not in ["SUPERADMIN", "OWNER"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires gym owner privileges.")
    return current_user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() not in ["SUPERADMIN", "OWNER", "ADMIN"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires admin privileges.")
    return current_user

def require_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.upper() not in ["SUPERADMIN", "OWNER", "ADMIN", "STAFF"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires staff privileges.")
    return current_user

def require_active_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    if current_user.role.upper() == "SUPERADMIN":
        return current_user
        
    if not current_user.gym_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario no asociado a un gimnasio.")
        
    from app.services.subscription_service import SubscriptionService
    
    has_access = SubscriptionService.has_active_subscription(db, current_user.gym_id)
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="SUBSCRIPTION_REQUIRED")
        
    return current_user