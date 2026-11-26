import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.email_service import EmailDeliveryError, mask_email, send_otp_email
from app.core.security import (
    ALGORITHM,
    LOGIN_LIMIT,
    OTP_LIMIT,
    REGISTER_LIMIT,
    SECRET_KEY,
    create_access_token,
    create_password_reset_token,
    hash_password,
    limiter,
    verify_password,
)
from app.db.dependencies import get_db
from app.models.auth_tokens import LoginOTP, PasswordResetOTP, PasswordResetToken
from app.models.shop import Shop
from app.models.user import User
from app.schemas.auth import (
    LoginStepResponse,
    OTPRequest,
    OTPVerifyRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(REGISTER_LIMIT)
def register(
    request: Request,
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    cleaned_phone = payload.phone.strip() if payload.phone else None

    existing_email = db.scalar(
        select(User).where(User.email == cleaned_email)
    )
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    if cleaned_phone:
        existing_phone = db.scalar(
            select(User).where(User.phone == cleaned_phone)
        )
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone number is already registered.")

    # Create a dedicated isolated Shop for each registered user
    shop = Shop(
        name=payload.full_name.strip(),
        slug=f"user-{uuid.uuid4().hex[:12]}",
        is_active=True,
    )
    db.add(shop)
    db.flush()

    user = User(
        shop_id=shop.id,
        full_name=payload.full_name.strip(),
        email=cleaned_email,
        phone=cleaned_phone,
        password_hash=hash_password(payload.password),
        role="owner",
        is_active=True,
        is_logged_in=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginStepResponse)
@limiter.limit(LOGIN_LIMIT)
def login(
    request: Request,
    payload: UserLogin,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == cleaned_email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated by administrator.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    record = LoginOTP(
        user_id=user.id,
        otp_hash=_hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(record)
    db.commit()

    try:
        sent_to = send_otp_email(user.email, otp, purpose="login")
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return LoginStepResponse(
        requires_otp=True,
        message=f"Verification code sent to {mask_email(sent_to)}",
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.is_logged_in = False
    db.commit()
    return {"message": "Logged out successfully"}


@router.post("/request-otp")
@limiter.limit(OTP_LIMIT)
def request_login_otp(
    request: Request,
    payload: OTPRequest,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == cleaned_email))
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    record = LoginOTP(
        user_id=user.id,
        otp_hash=_hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(record)
    db.commit()

    try:
        sent_to = send_otp_email(user.email, otp, purpose="login")
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"message": f"Verification code sent to {mask_email(sent_to)}"}


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit(OTP_LIMIT)
def verify_login_otp(
    request: Request,
    payload: OTPVerifyRequest,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == cleaned_email))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid account or deactivated.")

    otp_record = db.scalar(
        select(LoginOTP)
        .where(LoginOTP.user_id == user.id, LoginOTP.is_used.is_(False))
        .order_by(LoginOTP.created_at.desc())
        .limit(1)
    )
    if not otp_record or _as_utc(otp_record.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired or not found.")

    if otp_record.attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many invalid OTP attempts.")

    if not secrets.compare_digest(otp_record.otp_hash, _hash_otp(payload.otp.strip())):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    otp_record.is_used = True
    user.is_logged_in = True
    db.commit()

    token = create_access_token({"sub": user.email, "role": user.role})
    return TokenResponse(access_token=token)


@router.post("/forgot-password")
@limiter.limit(OTP_LIMIT)
def forgot_password(
    request: Request,
    payload: OTPRequest,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == cleaned_email))
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email.")

    otp = f"{secrets.randbelow(900000) + 100000}"
    record = PasswordResetOTP(
        user_id=user.id,
        otp_hash=_hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    db.add(record)
    db.commit()

    try:
        sent_to = send_otp_email(user.email, otp, purpose="password_reset")
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"message": f"Password reset code sent to {mask_email(sent_to)}"}


@router.post("/verify-reset-otp")
@limiter.limit(OTP_LIMIT)
def verify_reset_otp(
    request: Request,
    payload: OTPVerifyRequest,
    db: Session = Depends(get_db),
):
    cleaned_email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == cleaned_email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    otp_record = db.scalar(
        select(PasswordResetOTP)
        .where(PasswordResetOTP.user_id == user.id, PasswordResetOTP.is_used.is_(False))
        .order_by(PasswordResetOTP.created_at.desc())
        .limit(1)
    )
    if not otp_record or _as_utc(otp_record.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset OTP expired or not found.")

    if not secrets.compare_digest(otp_record.otp_hash, _hash_otp(payload.otp.strip())):
        otp_record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP code.")

    otp_record.is_used = True
    reset_token = create_password_reset_token(user.email)
    decoded = jwt.decode(reset_token, SECRET_KEY, algorithms=[ALGORITHM])
    db.add(
        PasswordResetToken(
            jti=decoded["jti"],
            user_id=user.id,
            expires_at=datetime.fromtimestamp(decoded["exp"], tz=timezone.utc),
        )
    )
    db.commit()
    return {"reset_token": reset_token}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    try:
        decoded = jwt.decode(payload.reset_token, SECRET_KEY, algorithms=[ALGORITHM])
        if decoded.get("token_type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token.")
        email = decoded.get("sub")
        jti = decoded.get("jti")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.") from exc

    token_row = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.jti == jti,
            PasswordResetToken.is_used.is_(False),
        )
    )
    if not token_row:
        raise HTTPException(status_code=400, detail="Reset token already used or invalid.")

    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    token_row.is_used = True
    db.commit()
    return {"message": "Password reset successfully. You can now sign in."}
