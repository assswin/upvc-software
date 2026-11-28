import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShopFormulaSetting(Base):
    __tablename__ = "shop_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    shop_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("shops.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    formulas_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
