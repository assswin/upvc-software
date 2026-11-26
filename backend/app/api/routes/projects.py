
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_shop
from app.db.dependencies import get_db
from app.models.customer import Customer
from app.models.project import Project
from app.models.shop import Shop
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectStatusUpdate,
)


router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


def generate_unique_project_serial_number(db: Session, shop: Shop) -> str:
    """Generate sequential unique project serial numbers per shop
    (e.g. PROJ-1, PROJ-2).
    """
    import re

    serials = db.scalars(
        select(Project.serial_number).where(Project.shop_id == shop.id)
    ).all()
    existing_nums = set()

    for serial in serials:
        if serial:
            match = re.search(r"(\d+)", serial)
            if match:
                try:
                    num = int(match.group(1))
                    existing_nums.add(num)
                except ValueError:
                    pass

    next_num = 1

    while next_num in existing_nums:
        next_num += 1

    return f"PROJ-{next_num}"


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    customer_statement = select(Customer).where(
        Customer.id == project_data.customer_id,
        Customer.shop_id == shop.id,
        Customer.is_active.is_(True),
    )

    customer = db.scalar(customer_statement)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active customer not found.",
        )

    cleaned_name = project_data.name.strip()
    status_val = project_data.status or "active"

    # Enforce unique project/order name per customer.
    existing_project = db.scalar(
        select(Project).where(
            Project.shop_id == shop.id,
            Project.customer_id == customer.id,
            Project.name.ilike(cleaned_name),
            Project.status != "inactive",
        )
    )

    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="enter unique name",
        )

    # Assign a unique project serial number.
    custom_serial = (
        project_data.serial_number.strip().upper()
        if project_data.serial_number and project_data.serial_number.strip()
        else None
    )

    if custom_serial:
        duplicate_serial = db.scalar(
            select(Project).where(
                Project.shop_id == shop.id,
                Project.serial_number == custom_serial,
            )
        )
        if duplicate_serial:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Serial number {custom_serial} "
                    "already exists in your shop."
                ),
            )

    max_attempts = 1 if custom_serial else 5
    for attempt in range(max_attempts):
        serial_val = custom_serial or generate_unique_project_serial_number(db, shop)
        project = Project(
            shop_id=shop.id,
            customer_id=customer.id,
            serial_number=serial_val,
            name=cleaned_name,
            description=project_data.description,
            status=status_val,
            input_unit=project_data.input_unit,
            output_unit=project_data.output_unit,
            default_tolerance_mm=project_data.default_tolerance_mm,
            default_apply_tolerance=project_data.default_apply_tolerance,
        )
        db.add(project)
        try:
            db.commit()
            db.refresh(project)
            return project
        except IntegrityError as exc:
            db.rollback()
            if custom_serial or attempt == max_attempts - 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Project serial number conflicted with an existing record.",
                ) from exc


@router.get("/", response_model=list[ProjectResponse])
def get_projects(
    customer_id: uuid.UUID | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    query = select(Project).where(Project.shop_id == shop.id)

    if status_filter and status_filter.lower() != "all":
        query = query.where(
            Project.status == status_filter.lower()
        )
    else:
        query = query.where(Project.status != "inactive")

    if customer_id is not None:
        query = query.where(
            Project.customer_id == customer_id
        )

    statement = query.order_by(Project.created_at.desc())
    return list(db.scalars(statement).all())


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Project).where(
        Project.id == project_id,
        Project.shop_id == shop.id,
        Project.status != "inactive",
    )

    project = db.scalar(statement)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    return project


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
)
def update_project(
    project_id: uuid.UUID,
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Project).where(
        Project.id == project_id,
        Project.shop_id == shop.id,
        Project.status != "inactive",
    )

    project = db.scalar(statement)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    customer_statement = select(Customer).where(
        Customer.id == project_data.customer_id,
        Customer.shop_id == shop.id,
        Customer.is_active.is_(True),
    )

    customer = db.scalar(customer_statement)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active customer not found.",
        )

    cleaned_name = project_data.name.strip()

    # Reject duplicate project names for this customer.
    existing_project = db.scalar(
        select(Project).where(
            Project.shop_id == shop.id,
            Project.customer_id == customer.id,
            Project.name.ilike(cleaned_name),
            Project.id != project_id,
            Project.status != "inactive",
        )
    )

    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="enter unique name",
        )

    project.customer_id = customer.id
    project.name = cleaned_name
    project.description = project_data.description
    project.input_unit = project_data.input_unit
    project.output_unit = project_data.output_unit
    project.default_tolerance_mm = project_data.default_tolerance_mm
    project.default_apply_tolerance = (
        project_data.default_apply_tolerance
    )

    if project_data.status:
        project.status = project_data.status

    db.commit()
    db.refresh(project)

    return project


@router.patch(
    "/{project_id}/status",
    response_model=ProjectResponse,
)
def update_project_status(
    project_id: uuid.UUID,
    payload: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Project).where(
        Project.id == project_id,
        Project.shop_id == shop.id,
    )

    project = db.scalar(statement)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    project.status = payload.status
    db.commit()
    db.refresh(project)

    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Project).where(
        Project.id == project_id,
        Project.shop_id == shop.id,
        Project.status != "inactive",
    )

    project = db.scalar(statement)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    project.status = "inactive"

    db.commit()

    return {
        "message": "Project deactivated successfully."
    }
