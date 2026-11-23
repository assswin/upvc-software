
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID


class ProjectCreate(BaseModel):
    customer_id: UUID

    name: str = Field(
        min_length=2,
        max_length=200,
    )

    serial_number: str | None = None
    description: str | None = None
    status: str | None = Field(default="pending", max_length=30)

    input_unit: str = Field(
        default="in",
        pattern="^(in|cm|mm)$",
    )

    output_unit: str = Field(
        default="mm",
        pattern="^(in|cm|mm)$",
    )

    default_tolerance_mm: Decimal = Field(
        default=Decimal("5"),
        ge=0,
        le=100,
    )

    default_apply_tolerance: bool = True


class ProjectResponse(BaseModel):
    id: UUID
    customer_id: UUID
    serial_number: str | None = None
    name: str
    description: str | None
    status: str
    input_unit: str
    output_unit: str
    default_tolerance_mm: Decimal
    default_apply_tolerance: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|active|completed|inactive)$")
