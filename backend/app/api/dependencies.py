from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.passcode import get_active_passcode_session
from app.db.dependencies import get_db
from app.models.passcode_session import PasscodeSession
from app.models.shop import Shop


def get_current_shop(
    ps: PasscodeSession = Depends(get_active_passcode_session),
    db: Session = Depends(get_db),
) -> Shop:
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
    return shop
