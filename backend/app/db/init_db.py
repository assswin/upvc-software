from sqlalchemy import select
from app.db.base import Base
from app.db.session import engine, SessionLocal
import app.models  # noqa: F401  # Register all models with Base.metadata
from app.models.shop import Shop


def init_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        statement = select(Shop).where(
            Shop.slug == "ls-interiors",
            Shop.is_active.is_(True),
        )
        shop = db.scalar(statement)
        if shop is None:
            shop = Shop(
                name="LS Interiors",
                slug="ls-interiors",
                is_active=True,
            )
            db.add(shop)
            db.commit()
