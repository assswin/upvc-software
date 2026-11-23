
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_shop
from app.db.dependencies import get_db
from app.models.measurement import Measurement
from app.models.project import Project
from app.models.shop import Shop
from app.schemas.measurement import (
    MeasurementCreate,
    MeasurementBatchCreate,
    MeasurementResponse,
    MeasurementStatusUpdate,
)


router = APIRouter(
    prefix="/projects/{project_id}/measurements",
    tags=["Measurements"],
)


UNIT_FACTORS = {
    "in": Decimal("25.4"),
    "cm": Decimal("10"),
    "mm": Decimal("1"),
}


def convert_to_mm(
    value: Decimal | None,
    unit: str,
) -> Decimal | None:
    if value is None:
        return None

    return value * UNIT_FACTORS[unit]


def get_active_project(
    project_id: uuid.UUID,
    db: Session,
    shop: Shop,
) -> Project:
    statement = select(Project).where(
        Project.id == project_id,
        Project.shop_id == shop.id,
        Project.status != "inactive",
    )

    project = db.scalar(statement)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active project not found.",
        )

    return project


# CREATE MEASUREMENT
@router.post(
    "/",
    response_model=MeasurementResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_measurement(
    project_id: uuid.UUID,
    measurement_data: MeasurementCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    input_unit = measurement_data.input_unit or project.input_unit

    measurement = Measurement(
        shop_id=shop.id,
        project_id=project.id,
        row_order=measurement_data.row_order,

        height=measurement_data.height,
        width=measurement_data.width,

        input_unit=input_unit,
        height_mm=convert_to_mm(
            measurement_data.height,
            input_unit,
        ),
        width_mm=convert_to_mm(
            measurement_data.width,
            input_unit,
        ),

        model_id=measurement_data.model_id,
        variant_letter=measurement_data.variant_letter or "",
        glass_type=measurement_data.glass_type,

        # Use project defaults when values are not provided
        tolerance_mm=(
            measurement_data.tolerance_mm
            if measurement_data.tolerance_mm is not None
            else project.default_tolerance_mm
        ),

        apply_tolerance=(
            measurement_data.apply_tolerance
            if measurement_data.apply_tolerance is not None
            else project.default_apply_tolerance
        ),

        height_additional_mm=measurement_data.height_additional_mm,
        width_additional_mm=measurement_data.width_additional_mm,
        identification_color=measurement_data.identification_color,
        status=measurement_data.status or "pending",
    )

    db.add(measurement)
    db.commit()
    db.refresh(measurement)

    return measurement


# BATCH CREATE OR REPLACE MEASUREMENTS
@router.post(
    "/batch",
    response_model=list[MeasurementResponse],
    status_code=status.HTTP_201_CREATED,
)
def batch_create_measurements(
    project_id: uuid.UUID,
    batch_data: MeasurementBatchCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    # Delete existing measurements for this project to maintain atomic sync
    existing_stmt = select(Measurement).where(
        Measurement.project_id == project.id,
        Measurement.shop_id == shop.id,
    )
    for existing in db.scalars(existing_stmt).all():
        db.delete(existing)

    created_measurements = []
    for item in batch_data.measurements:
        input_unit = item.input_unit or project.input_unit
        measurement = Measurement(
            shop_id=shop.id,
            project_id=project.id,
            row_order=item.row_order,
            height=item.height,
            width=item.width,
            input_unit=input_unit,
            height_mm=convert_to_mm(item.height, input_unit),
            width_mm=convert_to_mm(item.width, input_unit),
            model_id=item.model_id,
            variant_letter=item.variant_letter or "",
            glass_type=item.glass_type,
            tolerance_mm=(
                item.tolerance_mm
                if item.tolerance_mm is not None
                else project.default_tolerance_mm
            ),
            apply_tolerance=(
                item.apply_tolerance
                if item.apply_tolerance is not None
                else project.default_apply_tolerance
            ),
            height_additional_mm=item.height_additional_mm,
            width_additional_mm=item.width_additional_mm,
            identification_color=item.identification_color,
            status=item.status or "pending",
        )
        db.add(measurement)
        created_measurements.append(measurement)

    db.commit()
    for m in created_measurements:
        db.refresh(m)

    # Automatically complete project if all windows are finished
    if created_measurements:
        all_finished = all(m.status.lower() in ("finished", "completed") for m in created_measurements)
        if all_finished and project.status != "completed":
            project.status = "completed"
            db.commit()
        elif not all_finished and project.status == "completed":
            project.status = "active"
            db.commit()

    return created_measurements


# GET ALL MEASUREMENTS
@router.get("/", response_model=list[MeasurementResponse])
def get_measurements(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    statement = (
        select(Measurement)
        .where(
            Measurement.project_id == project.id,
            Measurement.shop_id == shop.id,
        )
        .order_by(Measurement.row_order.asc())
    )

    return db.scalars(statement).all()


# GET SINGLE MEASUREMENT
@router.get(
    "/{measurement_id}",
    response_model=MeasurementResponse,
)
def get_measurement(
    project_id: uuid.UUID,
    measurement_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    statement = select(Measurement).where(
        Measurement.id == measurement_id,
        Measurement.project_id == project.id,
        Measurement.shop_id == shop.id,
    )

    measurement = db.scalar(statement)

    if measurement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Measurement not found.",
        )

    return measurement


# UPDATE MEASUREMENT
@router.put(
    "/{measurement_id}",
    response_model=MeasurementResponse,
)
def update_measurement(
    project_id: uuid.UUID,
    measurement_id: uuid.UUID,
    measurement_data: MeasurementCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    statement = select(Measurement).where(
        Measurement.id == measurement_id,
        Measurement.project_id == project.id,
        Measurement.shop_id == shop.id,
    )

    measurement = db.scalar(statement)

    if measurement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Measurement not found.",
        )

    input_unit = measurement_data.input_unit or measurement.input_unit

    measurement.row_order = measurement_data.row_order

    measurement.height = measurement_data.height
    measurement.width = measurement_data.width

    measurement.input_unit = input_unit

    measurement.height_mm = convert_to_mm(
        measurement_data.height,
        input_unit,
    )

    measurement.width_mm = convert_to_mm(
        measurement_data.width,
        input_unit,
    )

    measurement.model_id = measurement_data.model_id
    measurement.variant_letter = measurement_data.variant_letter or ""
    measurement.glass_type = measurement_data.glass_type

    # Preserve existing tolerance settings when not provided
    if measurement_data.tolerance_mm is not None:
        measurement.tolerance_mm = measurement_data.tolerance_mm

    if measurement_data.apply_tolerance is not None:
        measurement.apply_tolerance = measurement_data.apply_tolerance

    measurement.height_additional_mm = measurement_data.height_additional_mm
    measurement.width_additional_mm = measurement_data.width_additional_mm
    measurement.identification_color = measurement_data.identification_color
    if measurement_data.status:
        measurement.status = measurement_data.status

    db.commit()
    db.refresh(measurement)

    return measurement


# PATCH MEASUREMENT STATUS (FINISHED / PENDING)
@router.patch(
    "/{measurement_id}/status",
    response_model=MeasurementResponse,
)
def update_measurement_status(
    project_id: uuid.UUID,
    measurement_id: uuid.UUID,
    payload: MeasurementStatusUpdate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    statement = select(Measurement).where(
        Measurement.id == measurement_id,
        Measurement.project_id == project.id,
        Measurement.shop_id == shop.id,
    )

    measurement = db.scalar(statement)

    if measurement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Measurement not found.",
        )

    measurement.status = payload.status
    db.commit()
    db.refresh(measurement)

    # Check all measurements to auto-update project status:
    # When all windows in a project are finished, project status automatically becomes 'completed'!
    # If any window is changed back to pending, project status automatically reverts to 'active'!
    all_ms = db.scalars(
        select(Measurement).where(
            Measurement.project_id == project.id,
            Measurement.shop_id == shop.id,
        )
    ).all()

    if all_ms:
        all_finished = all(m.status.lower() in ("finished", "completed") for m in all_ms)
        if all_finished and project.status != "completed":
            project.status = "completed"
            db.commit()
        elif not all_finished and project.status == "completed":
            project.status = "active"
            db.commit()

    return measurement


# POST BATCH MARK ALL MEASUREMENTS IN PROJECT (FINISHED / PENDING)
@router.post(
    "/mark-all-status",
    response_model=list[MeasurementResponse],
)
def mark_all_measurements_status(
    project_id: uuid.UUID,
    payload: MeasurementStatusUpdate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    all_ms = db.scalars(
        select(Measurement).where(
            Measurement.project_id == project.id,
            Measurement.shop_id == shop.id,
        )
    ).all()

    for m in all_ms:
        m.status = payload.status

    if payload.status == "finished":
        project.status = "completed"
    elif project.status == "completed":
        project.status = "active"

    db.commit()
    for m in all_ms:
        db.refresh(m)

    return all_ms


# DELETE MEASUREMENT
@router.delete("/{measurement_id}")
def delete_measurement(
    project_id: uuid.UUID,
    measurement_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    project = get_active_project(project_id, db, shop)

    statement = select(Measurement).where(
        Measurement.id == measurement_id,
        Measurement.project_id == project.id,
        Measurement.shop_id == shop.id,
    )

    measurement = db.scalar(statement)

    if measurement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Measurement not found.",
        )

    db.delete(measurement)
    db.commit()

    return {
        "message": "Measurement deleted successfully."
    }
