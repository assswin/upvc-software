import base64
import hashlib
import hmac
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


def _derive_cipher_keys(key_material: str) -> tuple[bytes, bytes]:
    raw = key_material.encode("utf-8")
    enc_key = hashlib.sha256(b"ls-enc:" + raw).digest()
    mac_key = hashlib.sha256(b"ls-mac:" + raw).digest()
    return enc_key, mac_key


def encrypt_secret(plaintext: str, key_material: str | None = None) -> str:
    secret = key_material or os.getenv("MAIL_ENC_KEY") or os.getenv("SECRET_KEY") or SECRET_KEY
    enc_key, mac_key = _derive_cipher_keys(secret)
    nonce = secrets.token_bytes(16)
    data = plaintext.encode("utf-8")

    keystream = bytearray()
    counter = 0
    while len(keystream) < len(data):
        block = hashlib.sha256(enc_key + nonce + counter.to_bytes(4, "big")).digest()
        keystream.extend(block)
        counter += 1

    ciphertext = bytes(a ^ b for a, b in zip(data, keystream[: len(data)]))
    tag = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()
    return "enc1:" + base64.urlsafe_b64encode(nonce + ciphertext + tag).decode("ascii")


def decrypt_secret(token: str, key_material: str | None = None) -> str:
    if not token or not token.startswith("enc1:"):
        return token
    secret = key_material or os.getenv("MAIL_ENC_KEY") or os.getenv("SECRET_KEY") or SECRET_KEY
    enc_key, mac_key = _derive_cipher_keys(secret)
    raw = base64.urlsafe_b64decode(token[5:].encode("ascii"))
    if len(raw) < 48:
        raise ValueError("Invalid encrypted secret format.")

    nonce = raw[:16]
    tag = raw[-32:]
    ciphertext = raw[16:-32]
    expected_tag = hmac.new(mac_key, nonce + ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, expected_tag):
        raise ValueError("Encrypted secret authentication failed.")

    keystream = bytearray()
    counter = 0
    while len(keystream) < len(ciphertext):
        block = hashlib.sha256(enc_key + nonce + counter.to_bytes(4, "big")).digest()
        keystream.extend(block)
        counter += 1

    plaintext = bytes(a ^ b for a, b in zip(ciphertext, keystream[: len(ciphertext)]))
    return plaintext.decode("utf-8")
