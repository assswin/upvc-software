from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MeasurementCreate(BaseModel):
    row_order: int = Field(ge=1)

    height: Decimal | None = Field(default=None, gt=0)
    width: Decimal | None = Field(default=None, gt=0)

    # Original measurement unit entered by the user
    input_unit: Literal["in", "cm", "mm"] | None = None

    model_id: str | None = Field(default=None, max_length=20)
    variant_letter: str | None = Field(default=None, max_length=10)
    glass_type: str | None = Field(default=None, max_length=100)

    tolerance_mm: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    apply_tolerance: bool | None = None

    height_additional_mm: Decimal = Decimal("0")
    width_additional_mm: Decimal = Decimal("0")

    identification_color: str = Field(max_length=20)
    status: str = Field(default="pending", max_length=30)


class MeasurementBatchCreate(BaseModel):
    measurements: list[MeasurementCreate]


class MeasurementStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|finished|in_progress)$")


class MeasurementResponse(BaseModel):
    id: UUID
    project_id: UUID
    row_order: int

    height: Decimal | None
    width: Decimal | None

    input_unit: str
    height_mm: Decimal | None
    width_mm: Decimal | None

    model_id: str | None
    variant_letter: str | None
    glass_type: str | None

    tolerance_mm: Decimal
    apply_tolerance: bool

    height_additional_mm: Decimal
    width_additional_mm: Decimal

    identification_color: str
    status: str = "pending"

    model_config = ConfigDict(from_attributes=True)
