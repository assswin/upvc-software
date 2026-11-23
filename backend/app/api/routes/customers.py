
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_shop
from app.db.dependencies import get_db
from app.models.customer import Customer
from app.models.shop import Shop
from app.schemas.customer import CustomerCreate, CustomerResponse


router = APIRouter(
    prefix="/customers",
    tags=["Customers"],
)


@router.post(
    "/",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    customer_data: CustomerCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    cleaned_name = customer_data.name.strip()
    cleaned_phone = customer_data.phone.strip() if customer_data.phone else None
    cleaned_email = customer_data.email.lower().strip() if customer_data.email else None

    # Deduplication check: Search by matching phone (if provided) or exact case-insensitive name
    existing_query = select(Customer).where(Customer.shop_id == shop.id)
    if cleaned_phone:
        existing_query = existing_query.where(
            (Customer.phone == cleaned_phone) |
            (Customer.name.ilike(cleaned_name))
        )
    else:
        existing_query = existing_query.where(Customer.name.ilike(cleaned_name))

    existing_customer = db.scalar(existing_query)
    if existing_customer:
        # Reuse and reactivate existing customer without creating duplicates
        existing_customer.name = cleaned_name
        if cleaned_phone:
            existing_customer.phone = cleaned_phone
        if cleaned_email:
            existing_customer.email = cleaned_email
        if customer_data.address:
            existing_customer.address = customer_data.address
        existing_customer.is_active = True
        db.commit()
        db.refresh(existing_customer)
        return existing_customer

    customer = Customer(
        shop_id=shop.id,
        name=cleaned_name,
        phone=cleaned_phone,
        email=cleaned_email,
        address=customer_data.address,
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    return customer


@router.get("/", response_model=list[CustomerResponse])
def get_customers(
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = (
        select(Customer)
        .where(
            Customer.shop_id == shop.id,
            Customer.is_active.is_(True),
        )
        .order_by(Customer.created_at.desc())
    )

    return db.scalars(statement).all()


@router.get(
    "/{customer_id}",
    response_model=CustomerResponse,
)
def get_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Customer).where(
        Customer.id == customer_id,
        Customer.shop_id == shop.id,
        Customer.is_active.is_(True),
    )

    customer = db.scalar(statement)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    return customer


@router.put(
    "/{customer_id}",
    response_model=CustomerResponse,
)
def update_customer(
    customer_id: uuid.UUID,
    customer_data: CustomerCreate,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Customer).where(
        Customer.id == customer_id,
        Customer.shop_id == shop.id,
        Customer.is_active.is_(True),
    )

    customer = db.scalar(statement)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    customer.name = customer_data.name.strip()
    customer.phone = customer_data.phone
    customer.email = (
        customer_data.email.lower()
        if customer_data.email
        else None
    )
    customer.address = customer_data.address

    db.commit()
    db.refresh(customer)

    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    shop: Shop = Depends(get_current_shop),
):
    statement = select(Customer).where(
        Customer.id == customer_id,
        Customer.shop_id == shop.id,
        Customer.is_active.is_(True),
    )

    customer = db.scalar(statement)

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )

    customer.is_active = False

    db.commit()

    return {
        "message": "Customer deactivated successfully."
    }
