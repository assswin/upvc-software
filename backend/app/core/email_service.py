import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class EmailDeliveryError(Exception):
    pass


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "****"
    user_part, domain = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    else:
        masked_user = user_part[0] + "*" * (len(user_part) - 2) + user_part[-1]
    return f"{masked_user}@{domain}"


def send_otp_email(recipient: str, otp: str, purpose: str) -> str:
    # Reload backend/.env on each call so email changes apply automatically without code edits
    load_dotenv(ENV_PATH, override=True)

    gmail_address = (os.getenv("GMAIL_ADDRESS") or "").strip()
    gmail_app_password = "".join((os.getenv("GMAIL_APP_PASSWORD") or "").split())
    receiver_override = (os.getenv("OTP_RECEIVER_EMAIL") or "").strip()
    target_recipient = receiver_override or recipient

    if purpose == "login":
        subject = "LS Interiors - Your login verification code"
        purpose_text = "log in"
    elif purpose == "password_reset":
        subject = "LS Interiors - Your password reset code"
        purpose_text = "reset your password"
    else:
        raise ValueError(f"Unsupported OTP email purpose: {purpose}")

    if not gmail_address or len(gmail_app_password) != 16:
        logger.warning(
            "GMAIL_APP_PASSWORD is not configured. Printing OTP to local console for development."
        )
        print(
            f"\n========================================\n"
            f"[LOCAL DEV OTP] Purpose: {purpose_text.upper()}\n"
            f"Recipient: {target_recipient}\n"
            f"OTP Code:  {otp}\n"
            f"Expires in: 5 minutes\n"
            f"========================================\n"
        )
        return target_recipient

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = gmail_address
    message["To"] = target_recipient
    message.set_content(
        f"Your verification code to {purpose_text} is {otp}.\n\n"
        "This code expires in 5 minutes."
    )

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(gmail_address, gmail_app_password)
            server.send_message(message)
        return target_recipient
    except Exception as exc:
        logger.error("Failed to send OTP email: %s", exc)
        raise EmailDeliveryError("Failed to deliver verification email.") from exc
