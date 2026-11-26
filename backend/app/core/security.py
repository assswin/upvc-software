import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
import jwt
from pwdlib import PasswordHash
from slowapi import Limiter
from slowapi.util import get_remote_address

ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(ENV_PATH)

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


limiter = Limiter(key_func=get_remote_address)

REGISTER_LIMIT = "5/minute"
LOGIN_LIMIT = "5/minute"
OTP_LIMIT = "10/minute"

SECRET_KEY = os.getenv("SECRET_KEY") or "ls-interiors-dev-secret-change-in-production-9823482347"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
ADMIN_PASSCODE = os.getenv("ADMIN_PASSCODE", "735195")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "token_type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {
        "sub": email,
        "token_type": "password_reset",
        "jti": secrets.token_hex(32),
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
