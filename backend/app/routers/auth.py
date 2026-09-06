from fastapi import APIRouter, Depends, Request, HTTPException, status, Response, Cookie
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
from app.models.refresh_token import RefreshToken
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
    try:
        from sqlalchemy import text
        # Bypassing RLS because registration needs to lookup the user/gym globally
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

        existing_user = db.query(User).filter(User.email == payload.owner_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya se encuentra registrado."
            )

        existing_gym = db.query(Gym).filter(Gym.email == payload.owner_email).first()
        if existing_gym:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo ya se encuentra registrado por otro gimnasio."
            )

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
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar el registro."
        )
    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

@router.post("/login")
@limiter.limit(RateLimitConfig.LOGIN)
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    from sqlalchemy import text
    samesite_policy = "lax" if settings.ENVIRONMENT.lower() == "development" else "none"
    secure_policy = False if settings.ENVIRONMENT.lower() == "development" else True

    # Bypass RLS to allow finding the user globally by email during login
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    try:
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

        raw_refresh = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(raw_refresh.encode()).hexdigest()
        expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=7)
        
        rt = RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at)
        db.add(rt)
        db.commit()

        _set_refresh_cookie(response, raw_refresh, secure_policy, samesite_policy)

        return {
            "access_token": token,
            "token_type": "bearer"
        }
    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

def _extract_refresh_tokens(request: Request, cookie_param: str | None) -> list[str]:
    cookie_hdr = request.headers.get("cookie", "")
    tokens = []
    if cookie_hdr:
        for part in cookie_hdr.split(";"):
            part = part.strip()
            if part.startswith("refresh_token="):
                val = part[len("refresh_token="):].strip()
                if val and val not in tokens:
                    tokens.append(val)
    if cookie_param and cookie_param not in tokens:
        tokens.append(cookie_param)
    return tokens

def _set_refresh_cookie(response: Response, raw_token: str, secure: bool, samesite: str):
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    # Ensure any legacy /auth cookie is explicitly cleared from browser jar
    response.delete_cookie(
        key="refresh_token",
        path="/auth",
        secure=secure,
        samesite=samesite,
        httponly=True
    )

def _clear_refresh_cookie(response: Response, secure: bool, samesite: str):
    response.delete_cookie(
        key="refresh_token",
        path="/",
        secure=secure,
        samesite=samesite,
        httponly=True
    )
    response.delete_cookie(
        key="refresh_token",
        path="/auth",
        secure=secure,
        samesite=samesite,
        httponly=True
    )

@router.post("/refresh")
@limiter.limit(RateLimitConfig.LOGIN)
def refresh_token(
    request: Request,
    response: Response,
    refresh_token: str = Cookie(None),
    db: Session = Depends(get_db)
):
    samesite_policy = "lax" if settings.ENVIRONMENT.lower() == "development" else "none"
    secure_policy = False if settings.ENVIRONMENT.lower() == "development" else True

    tokens = _extract_refresh_tokens(request, refresh_token)
    if not tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing.")

    now = datetime.now(UTC).replace(tzinfo=None)
    GRACE_PERIOD_SECONDS = 30  # Leeway window for concurrent / double-mount requests

    # Bypass RLS to inspect tokens
    db.info['bypass_rls'] = True
    db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))

    try:
        # Phase 1: Search for an active, unrevoked token among all candidate cookies
        active_rt = None
        active_raw = None
        seen_rts = []

        for tok in tokens:
            h = hashlib.sha256(tok.encode()).hexdigest()
            record = db.query(RefreshToken).filter(RefreshToken.token_hash == h).first()
            if record:
                seen_rts.append(record)
                if not record.revoked_at and not record.replaced_by and record.expires_at > now:
                    active_rt = record
                    active_raw = tok
                    break

        # Phase 2: If an active token is found, perform normal rotation
        if active_rt:
            user = db.query(User).filter(User.id == active_rt.user_id).first()
            if not user or not user.is_active:
                _clear_refresh_cookie(response, secure_policy, samesite_policy)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User invalid.")

            raw_new_refresh = secrets.token_urlsafe(64)
            new_token_hash = hashlib.sha256(raw_new_refresh.encode()).hexdigest()
            new_expires_at = now + timedelta(days=7)

            new_rt = RefreshToken(user_id=user.id, token_hash=new_token_hash, expires_at=new_expires_at)
            db.add(new_rt)

            active_rt.revoked_at = now
            active_rt.replaced_by = new_token_hash
            db.commit()

            new_access_token = create_access_token(
                data={
                    "sub": user.email,
                    "user_id": user.id,
                    "gym_id": user.gym_id,
                    "role": user.role
                }
            )

            _set_refresh_cookie(response, raw_new_refresh, secure_policy, samesite_policy)

            return {
                "access_token": new_access_token,
                "token_type": "bearer"
            }

        # Phase 3: No active token found. Check if any seen token was recently rotated (Grace Period)
        for record in seen_rts:
            if record.replaced_by and record.revoked_at:
                elapsed = (now - record.revoked_at).total_seconds()
                if 0 <= elapsed <= GRACE_PERIOD_SECONDS:
                    # Token was rotated within grace window (rapid double-mount or navigation race)
                    successor = db.query(RefreshToken).filter(RefreshToken.token_hash == record.replaced_by).first()
                    if successor and not successor.revoked_at and successor.expires_at > now:
                        user = db.query(User).filter(User.id == successor.user_id).first()
                        if user and user.is_active:
                            new_access_token = create_access_token(
                                data={
                                    "sub": user.email,
                                    "user_id": user.id,
                                    "gym_id": user.gym_id,
                                    "role": user.role
                                }
                            )
                            # Idempotent recovery within grace period: return valid token without revoking or clearing active root cookie
                            response.delete_cookie(
                                key="refresh_token",
                                path="/auth",
                                secure=secure_policy,
                                samesite=samesite_policy,
                                httponly=True
                            )
                            return {
                                "access_token": new_access_token,
                                "token_type": "bearer"
                            }

        # Phase 4: If any seen token was replaced/revoked outside grace period -> REPLAY DETECTED
        for record in seen_rts:
            if record.revoked_at or record.replaced_by:
                # Replay attack confirmed! Revoke token family
                db.query(RefreshToken).filter(RefreshToken.user_id == record.user_id).update({"revoked_at": now})
                db.commit()
                _clear_refresh_cookie(response, secure_policy, samesite_policy)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token compromised.")

        # Phase 5: Check expired
        for record in seen_rts:
            if record.expires_at <= now:
                _clear_refresh_cookie(response, secure_policy, samesite_policy)
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired.")

        # Phase 6: Not found in database at all
        _clear_refresh_cookie(response, secure_policy, samesite_policy)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token invalid.")

    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    refresh_token: str = Cookie(None),
    db: Session = Depends(get_db)
):
    samesite_policy = "lax" if settings.ENVIRONMENT.lower() == "development" else "none"
    secure_policy = False if settings.ENVIRONMENT.lower() == "development" else True

    tokens = _extract_refresh_tokens(request, refresh_token)
    if tokens:
        now = datetime.now(UTC).replace(tzinfo=None)
        db.info['bypass_rls'] = True
        db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
        try:
            for tok in tokens:
                token_hash = hashlib.sha256(tok.encode()).hexdigest()
                rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
                if rt and not rt.revoked_at:
                    rt.revoked_at = now
            db.commit()
        finally:
            db.info.pop('bypass_rls', None)
            db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

    _clear_refresh_cookie(response, secure_policy, samesite_policy)

    return {"message": "Logged out successfully"}

@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.services.subscription_service import SubscriptionService
    
    subscription_info = None
    if current_user.gym_id:
        sub = SubscriptionService.get_current_subscription(db, current_user.gym_id)
        if sub:
            subscription_info = {
                "status": sub.status.value,
                "ends_at": sub.ends_at.isoformat() + "Z" if sub.ends_at else None,
                "starts_at": sub.starts_at.isoformat() + "Z" if sub.starts_at else None,
                "is_lifetime": sub.is_lifetime,
            }

    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "gym_id": current_user.gym_id,
        "onboarding_completed": current_user.gym.onboarding_completed if current_user.gym else True,
        "subscription": subscription_info
    }

def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


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

    try:
        user = db.query(User).filter(User.email == payload.email).first()

        # Generic success message to prevent user enumeration
        success_message = {"message": "Si existe una cuenta asociada a este correo, recibirás instrucciones para recuperar tu contraseña."}

        if not user or not user.is_active:
            return success_message

        # Invalidate previous active tokens for this user
        now_utc = datetime.now(UTC)
        active_tokens = db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None)
        ).all()
        for tok in active_tokens:
            if _ensure_utc(tok.expires_at) > now_utc:
                tok.used_at = now_utc

        # Generate secure random token
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        expires_at = now_utc + timedelta(minutes=settings.TOKEN_EXPIRATION_MINUTES)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=now_utc
        )
        db.add(reset_token)
        db.commit()

        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
        try:
            email_service.send_password_reset_email(user.email, reset_url)
        except RuntimeError:
            # Roll back the token so the user can retry with a fresh one
            try:
                db.delete(reset_token)
                db.commit()
            except Exception:
                db.rollback()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El servicio de correo no está disponible en este momento. Inténtalo más tarde."
            )

        return success_message
    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

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

    try:
        reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

        if not reset_token:
            raise HTTPException(status_code=400, detail="El enlace de recuperación no es válido.")
        
        if reset_token.used_at:
            raise HTTPException(status_code=400, detail="El enlace de recuperación ya fue utilizado.")

        if _ensure_utc(reset_token.expires_at) < datetime.now(UTC):
            raise HTTPException(status_code=400, detail="El enlace de recuperación ha expirado.")
        
        user = db.query(User).filter(User.id == reset_token.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=400, detail="El usuario asociado a este enlace no es válido.")

        return {"valid": True, "email": user.email}
    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))

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

    try:
        reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()

        if not reset_token:
            raise HTTPException(status_code=400, detail="El enlace de recuperación no es válido.")
        
        if reset_token.used_at:
            raise HTTPException(status_code=400, detail="El enlace de recuperación ya fue utilizado.")

        if _ensure_utc(reset_token.expires_at) < datetime.now(UTC):
            raise HTTPException(status_code=400, detail="El enlace de recuperación ha expirado.")

        user = db.query(User).filter(User.id == reset_token.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=400, detail="El usuario asociado a este enlace no es válido.")

        # Update user password using existing mechanism
        user.password = hash_password(payload.new_password)
        
        now_utc = datetime.now(UTC)
        # Mark current token as used
        reset_token.used_at = now_utc

        # Invalidate any other active reset tokens for this user
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != reset_token.id,
            PasswordResetToken.used_at.is_(None)
        ).update({"used_at": now_utc})

        # Revoke all active refresh tokens to invalidate open sessions
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None)
        ).update({"revoked_at": now_utc.replace(tzinfo=None)})

        db.commit()
        return {"message": "Tu contraseña ha sido restablecida exitosamente."}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al restablecer la contraseña.")
    finally:
        db.info.pop('bypass_rls', None)
        db.execute(text("SELECT set_config('app.bypass_rls', 'off', true)"))