from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest
from app.models.user import User
from app.models.gym import Gym
from app.models.gym_settings import GymSettings
from app.models.subscription import Subscription
from datetime import datetime, timedelta, UTC
from app.core.security import verify_password, hash_password, create_access_token
from app.core.auth import get_current_user
from app.middleware.rate_limiter import limiter, RateLimitConfig
from fastapi.security import OAuth2PasswordRequestForm
import secrets
import hashlib
from app.models.password_reset_token import PasswordResetToken
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
from app.services.email_service import email_service
from app.core.config import settings
from sqlalchemy import text

router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"]
)


@router.get("/")
def auth_home():
    return {
        "message": "Módulo de autenticación funcionando correctamente."
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit(RateLimitConfig.REGISTER)
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(User.email == payload.owner_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya se encuentra registrado."
        )

    try:
        from sqlalchemy import text
        # Bypassing RLS because login needs to lookup the user globally
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        new_user = User(
            full_name=payload.owner_name,
            email=payload.owner_email,
            password=hash_password(payload.owner_password),
            role="OWNER"
        )
        db.add(new_user)
        db.flush()

        new_gym = Gym(
            name=payload.gym_name,
            email=payload.owner_email,
            phone=payload.gym_phone,
            address=f"{payload.gym_address}, {payload.gym_city}",
            owner_id=new_user.id,
            onboarding_completed=False
        )
        db.add(new_gym)
        db.flush()

        new_user.gym_id = new_gym.id

        new_settings = GymSettings(
            gym_id=new_gym.id,
            legal_name=payload.gym_legal_name or payload.gym_name,
            trade_name=payload.gym_name,
            tax_id="PENDIENTE", 
            official_phone=payload.gym_phone,
            official_email=payload.owner_email,
            physical_address=payload.gym_address,
            city=payload.gym_city
        )
        db.add(new_settings)

        # We no longer create a default TRIAL subscription here.
        # The user will choose their intent (Trial or Purchase) during onboarding or checkout.

        db.commit()
        return {"message": "Gimnasio registrado exitosamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar el registro."
        )

@router.post("/login")
@limiter.limit(RateLimitConfig.LOGIN)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    from sqlalchemy import text
    # Bypass RLS to allow finding the user globally by email during login
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    user = (
        db.query(User)
        .filter(User.email == form_data.username)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )

    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado. Contacte al administrador."
        )

    token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "gym_id": user.gym_id,
            "role": user.role
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "gym_id": current_user.gym_id,
        "onboarding_completed": current_user.gym.onboarding_completed if current_user.gym else True
    }

@router.post("/forgot-password")
@limiter.limit(RateLimitConfig.LOGIN)
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    # Bypass RLS to find the user by email globally
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    user = db.query(User).filter(User.email == payload.email).first()

    # Generic success message to prevent user enumeration
    success_message = {"message": "Si existe una cuenta asociada a este correo, recibirás instrucciones para recuperar tu contraseña."}

    if not user or not user.is_active:
        return success_message

    # Invalidate previous active tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > datetime.now(UTC)
    ).update({"used_at": datetime.now(UTC)})
    
    # Generate secure random token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.TOKEN_EXPIRATION_MINUTES)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    email_service.send_password_reset_email(user.email, reset_url)

    return success_message

@router.get("/reset-password/validate")
@limiter.limit(RateLimitConfig.LOGIN)
def validate_reset_token(
    request: Request,
    token: str,
    db: Session = Depends(get_db)
):
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Bypass RLS to validate token globally
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="El enlace de recuperación no es válido.")
    
    if reset_token.used_at:
        raise HTTPException(status_code=400, detail="El enlace de recuperación ya fue utilizado.")

    if reset_token.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="El enlace de recuperación ha expirado.")
    
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="El usuario asociado a este enlace no es válido.")

    return {"valid": True, "email": user.email}

@router.post("/reset-password")
@limiter.limit(RateLimitConfig.LOGIN)
def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()

    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="El enlace de recuperación no es válido.")
    
    if reset_token.used_at:
        raise HTTPException(status_code=400, detail="El enlace de recuperación ya fue utilizado.")

    if reset_token.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="El enlace de recuperación ha expirado.")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="El usuario asociado a este enlace no es válido.")

    try:
        # Update user password using existing mechanism
        user.password = hash_password(payload.new_password)
        
        # Mark current token as used
        reset_token.used_at = datetime.now(UTC)

        # Invalidate any other active tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset_token.id,
            PasswordResetToken.used_at.is_(None)
        ).update({"used_at": datetime.now(UTC)})

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al restablecer la contraseña.")

    return {"message": "Tu contraseña ha sido restablecida exitosamente."}