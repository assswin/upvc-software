import secrets
import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.dependencies import bearer_scheme
from app.core.security import ADMIN_PASSCODE, ALGORITHM, SECRET_KEY, create_access_token
from app.db.dependencies import get_db
from app.models.auth_tokens import LoginOTP, PasswordResetOTP, PasswordResetToken
from app.models.user import User
from app.schemas.auth import AdminAuthRequest, UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


def verify_admin_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> bool:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin permissions required.")
        return True
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session.") from exc


@router.post("/login")
def admin_login(payload: AdminAuthRequest):
    if not secrets.compare_digest(payload.passcode.strip(), ADMIN_PASSCODE):
        raise HTTPException(status_code=401, detail="Invalid admin passcode.")

    token = create_access_token({"sub": "admin", "role": "admin"})
    return {
        "admin_token": token,
        "message": "Admin session authenticated successfully.",
    }


@router.get("/users", response_model=list[UserResponse])
def admin_get_all_users(
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    return list(db.scalars(select(User).order_by(User.created_at.desc())).all())


@router.post("/users/{user_id}/toggle-block", response_model=UserResponse)
def admin_toggle_block_user(
    user_id: uuid.UUID,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.is_active = not user.is_active
    if not user.is_active:
        user.is_logged_in = False
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: uuid.UUID,
    _: bool = Depends(verify_admin_token),
    db: Session = Depends(get_db),
):
    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.execute(delete(LoginOTP).where(LoginOTP.user_id == user.id))
    db.execute(delete(PasswordResetOTP).where(PasswordResetOTP.user_id == user.id))
    db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id))
    db.delete(user)
    db.commit()
    return {"message": f"User {user.email} permanently deleted."}
