import hashlib
import os
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.passcode_session import PasscodeSession
from app.models.shop import Shop

ENV_PATH = Path(__file__).resolve().parent.parent.parent.parent / ".env"
SESSION_TIMEOUT_SECONDS = 60
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 5

router = APIRouter(prefix="/passcode", tags=["Passcode"])
bearer_scheme = HTTPBearer()

# Track failed passcode attempts per client IP to block combination guessing
_failed_attempts: dict[str, list[datetime]] = defaultdict(list)
_locked_until: dict[str, datetime] = {}


class PasscodeLoginRequest(BaseModel):
    passcode: str = Field(min_length=4, max_length=64)


def _hash_value(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _get_configured_passcodes() -> list[str]:
    load_dotenv(ENV_PATH, override=True)
    raw = os.getenv("APP_PASSCODES", "")
    codes = [c.strip() for c in raw.split(",") if c.strip()]
    # Strictly limit to the configured passcodes (2 unique users)
    return codes[:2]


def _sync_passcode_shops(db: Session) -> list[PasscodeSession]:
    codes = _get_configured_passcodes()
    if not codes:
        return []

    sessions: list[PasscodeSession] = []
    for idx, code in enumerate(codes, start=1):
        code_hash = _hash_value(code)
        ps = db.scalar(
            select(PasscodeSession).where(PasscodeSession.passcode_hash == code_hash)
        )
        if ps is None:
            shop = Shop(
                name=f"LS Interiors User {idx}",
                slug=f"passcode-user-{idx}-{secrets.token_hex(4)}",
                is_active=True,
            )
            db.add(shop)
            db.flush()
            ps = PasscodeSession(
                passcode_hash=code_hash,
                label=f"User {idx}",
                shop_id=shop.id,
                is_in_use=False,
            )
            db.add(ps)
            db.commit()
            db.refresh(ps)
        sessions.append(ps)
    return sessions


def _check_rate_limit(client_ip: str) -> None:
    now = datetime.now(timezone.utc)
    lock_expiry = _locked_until.get(client_ip)
    if lock_expiry and now < lock_expiry:
        remaining = int((lock_expiry - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many invalid passcode attempts. Try again in {remaining}s.",
        )
    if lock_expiry and now >= lock_expiry:
        _locked_until.pop(client_ip, None)
        _failed_attempts.pop(client_ip, None)


def _record_failure(client_ip: str) -> None:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=LOCKOUT_MINUTES)
    recent = [t for t in _failed_attempts[client_ip] if t > cutoff]
    recent.append(now)
    _failed_attempts[client_ip] = recent
    if len(recent) >= MAX_FAILED_ATTEMPTS:
        _locked_until[client_ip] = now + timedelta(minutes=LOCKOUT_MINUTES)


@router.post("/login")
def passcode_login(
    request: Request,
    payload: PasscodeLoginRequest,
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    _sync_passcode_shops(db)
    entered = payload.passcode.strip()
    entered_hash = _hash_value(entered)

    # Constant-time style lookup across configured passcodes only
    configured = _get_configured_passcodes()
    matched = any(secrets.compare_digest(entered, c) for c in configured)
    if not matched:
        _record_failure(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid passcode.",
        )

    ps = db.scalar(
        select(PasscodeSession).where(PasscodeSession.passcode_hash == entered_hash)
    )
    if ps is None:
        _record_failure(client_ip)
        raise HTTPException(status_code=401, detail="Invalid passcode.")

    now = datetime.now(timezone.utc)
    last_seen = _as_utc(ps.last_seen_at)
    is_stale = (
        last_seen is None
        or (now - last_seen).total_seconds() > SESSION_TIMEOUT_SECONDS
    )

    # Block second user if this passcode is currently active and not stale
    if ps.is_in_use and not is_stale:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This passcode is already in use by another active session.",
        )

    _failed_attempts.pop(client_ip, None)
    _locked_until.pop(client_ip, None)

    raw_token = secrets.token_urlsafe(32)
    ps.is_in_use = True
    ps.session_token_hash = _hash_value(raw_token)
    ps.last_seen_at = now
    db.commit()

    return {
        "session_token": raw_token,
        "label": ps.label,
    }


def get_active_passcode_session(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> PasscodeSession:
    token_hash = _hash_value(credentials.credentials)
    ps = db.scalar(
        select(PasscodeSession).where(
            PasscodeSession.session_token_hash == token_hash,
            PasscodeSession.is_in_use.is_(True),
        )
    )
    if ps is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or logged out.",
        )

    now = datetime.now(timezone.utc)
    last_seen = _as_utc(ps.last_seen_at)
    if last_seen and (now - last_seen).total_seconds() > SESSION_TIMEOUT_SECONDS:
        ps.is_in_use = False
        ps.session_token_hash = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session timed out.",
        )

    ps.last_seen_at = now
    db.commit()
    return ps


@router.post("/heartbeat")
def passcode_heartbeat(
    ps: PasscodeSession = Depends(get_active_passcode_session),
):
    return {"status": "active", "label": ps.label}


@router.post("/logout")
def passcode_logout(
    ps: PasscodeSession = Depends(get_active_passcode_session),
    db: Session = Depends(get_db),
):
    ps.is_in_use = False
    ps.session_token_hash = None
    ps.last_seen_at = None
    db.commit()
    return {"message": "Logged out and passcode released."}
