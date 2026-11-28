import json
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_shop
from app.db.dependencies import get_db
from app.models.shop import Shop
from app.models.shop_setting import ShopFormulaSetting


router = APIRouter(
    prefix="/settings",
    tags=["Settings"],
)


class FormulaSettingsPayload(BaseModel):
    formulas: dict[str, dict[str, Any]] = Field(default_factory=dict)


@router.get("/formulas")
def get_formula_settings(
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    record = db.scalar(
        select(ShopFormulaSetting).where(ShopFormulaSetting.shop_id == shop.id)
    )
    if record is None or not record.formulas_json:
        return {"formulas": {}}

    try:
        parsed = json.loads(record.formulas_json)
        return {"formulas": parsed if isinstance(parsed, dict) else {}}
    except ValueError:
        return {"formulas": {}}


@router.put("/formulas")
def save_formula_settings(
    payload: FormulaSettingsPayload,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    serialized = json.dumps(payload.formulas)
    record = db.scalar(
        select(ShopFormulaSetting).where(ShopFormulaSetting.shop_id == shop.id)
    )
    if record is None:
        record = ShopFormulaSetting(
            shop_id=shop.id,
            formulas_json=serialized,
        )
        db.add(record)
    else:
        record.formulas_json = serialized

    db.commit()
    return {"formulas": payload.formulas}
