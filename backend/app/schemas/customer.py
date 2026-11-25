
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def validate_phone(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    if not cleaned.isdigit():
        raise ValueError("Phone number must contain digits only.")

    if len(cleaned) > 10:
        raise ValueError("Phone number must not exceed 10 digits.")

    if len(cleaned) < 10:
        raise ValueError("Phone number must contain exactly 10 digits.")

    return cleaned


def validate_serial_number(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    if len(cleaned) > 50:
        raise ValueError("Serial number must not exceed 50 characters.")

    return cleaned


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=10)
    serial_number: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    address: str | None = None

    _validate_phone = field_validator("phone", mode="before")(validate_phone)
    _validate_serial_number = field_validator("serial_number", mode="before")(
        validate_serial_number
    )


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone: str | None
    serial_number: str
    email: str | None
    address: str | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
