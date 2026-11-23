
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Measurement(Base):
    __tablename__ = "measurements"

    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "shop_id"],
            ["projects.id", "projects.shop_id"],
            name="fk_measurements_project_shop",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("shops.id"),
        nullable=False,
        index=True,
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        nullable=False,
        index=True,
    )

    row_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    # Original dimensions entered by the user
    height: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )

    width: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )

    # Unit used for the original dimensions
    input_unit: Mapped[str] = mapped_column(
        String(5),
        nullable=False,
        default="in",
    )

    # Normalized dimensions used for calculations
    height_mm: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )

    width_mm: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 4),
        nullable=True,
    )

    model_id: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    variant_letter: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        default="",
    )

    glass_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    tolerance_mm: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("5"),
        nullable=False,
    )

    apply_tolerance: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    height_additional_mm: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0"),
        nullable=False,
    )

    width_additional_mm: Mapped[Decimal] = mapped_column(
        Numeric(10, 3),
        default=Decimal("0"),
        nullable=False,
    )

    identification_color: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
