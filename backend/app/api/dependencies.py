from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import ALGORITHM, SECRET_KEY
from app.db.dependencies import get_db
from app.models.shop import Shop
from app.models.user import User

bearer_scheme = HTTPBearer()


def get_or_create_default_shop(db: Session) -> Shop:
    shop = db.scalar(select(Shop).where(Shop.slug == "ls-interiors"))
    if shop is None:
        shop = Shop(name="LS Interiors", slug="ls-interiors", is_active=True)
        db.add(shop)
        db.commit()
        db.refresh(shop)
    return shop


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        token_type = payload.get("token_type")
        if not email or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    return user


def get_current_shop(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Shop:
    shop = db.scalar(
        select(Shop).where(
            Shop.id == current_user.shop_id,
            Shop.is_active.is_(True),
        )
    )
    if shop is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shop is inactive or unavailable",
        )
    return shop
