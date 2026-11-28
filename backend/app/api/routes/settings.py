import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
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
    project_id: uuid.UUID | None = None
    formulas: dict[str, dict[str, Any]] = Field(default_factory=dict)


def _load_settings_dict(record: ShopFormulaSetting | None) -> dict[str, Any]:
    if record is None or not record.formulas_json:
        return {}
    try:
        parsed = json.loads(record.formulas_json)
        return parsed if isinstance(parsed, dict) else {}
    except ValueError:
        return {}


@router.get("/formulas")
def get_formula_settings(
    project_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    if project_id is None:
        # New customers/orders always start at workshop default formulas
        return {"formulas": {}}

    record = db.scalar(
        select(ShopFormulaSetting).where(ShopFormulaSetting.shop_id == shop.id)
    )
    data = _load_settings_dict(record)
    projects_map = data.get("__projects__", {})
    if isinstance(projects_map, dict):
        proj_formulas = projects_map.get(str(project_id), {})
        if isinstance(proj_formulas, dict):
            return {"formulas": proj_formulas}
    return {"formulas": {}}


@router.put("/formulas")
def save_formula_settings(
    payload: FormulaSettingsPayload,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    if payload.project_id is None:
        return {"formulas": payload.formulas}

    record = db.scalar(
        select(ShopFormulaSetting).where(ShopFormulaSetting.shop_id == shop.id)
    )
    data = _load_settings_dict(record)
    projects_map = data.get("__projects__")
    if not isinstance(projects_map, dict):
        projects_map = {}

    key = str(payload.project_id)
    if payload.formulas:
        projects_map[key] = payload.formulas
    else:
        projects_map.pop(key, None)

    data["__projects__"] = projects_map
    serialized = json.dumps(data)

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
