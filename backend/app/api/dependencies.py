from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.shop import Shop


def get_current_shop(
    db: Session = Depends(get_db),
) -> Shop:
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
        db.refresh(shop)

    return shop
