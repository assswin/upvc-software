from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.passcode import get_active_passcode_session
from app.db.dependencies import get_db
from app.models.passcode_session import PasscodeSession
from app.models.shop import Shop

# Cache the Shop object on the PasscodeSession to avoid an
# extra DB round-trip on every authenticated request.
_shop_cache: dict[str, Shop] = {}


def get_current_shop(
    ps: PasscodeSession = Depends(get_active_passcode_session),
    db: Session = Depends(get_db),
) -> Shop:
    shop_id_str = str(ps.shop_id)
    cached = _shop_cache.get(shop_id_str)
    if cached is not None:
        # Merge into the current session so SQLAlchemy can track it
        merged = db.merge(cached, load=False)
        return merged

    shop = db.scalar(
        select(Shop).where(
            Shop.id == ps.shop_id,
            Shop.is_active.is_(True),
        )
    )
    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shop is inactive or unavailable.",
        )
    _shop_cache[shop_id_str] = shop
    return shop
