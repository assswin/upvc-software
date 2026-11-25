"""add customer serial number

Revision ID: b7c2d4e8f901
Revises: a736c2e84f03
Create Date: 2026-11-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c2d4e8f901"
down_revision: Union[str, Sequence[str], None] = "a736c2e84f03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column("serial_number", sa.String(length=50), nullable=True),
    )
    op.create_index(
        op.f("ix_customers_serial_number"),
        "customers",
        ["serial_number"],
        unique=False,
    )

    connection = op.get_bind()
    customers = sa.table(
        "customers",
        sa.column("id", sa.Uuid()),
        sa.column("shop_id", sa.Uuid()),
        sa.column("serial_number", sa.String()),
    )

    rows = connection.execute(
        sa.select(customers.c.id, customers.c.shop_id).order_by(
            customers.c.shop_id,
            customers.c.id,
        )
    ).all()

    used_serials: dict[object, set[str]] = {}
    for customer_id, shop_id in rows:
        used = used_serials.setdefault(shop_id, set())
        if hasattr(customer_id, "hex"):
            suffix = customer_id.hex[:8].upper()
        else:
            suffix = str(customer_id).replace("-", "")[:8].upper()

        serial_number = f"CUST-{suffix}"
        counter = 2
        while serial_number in used:
            serial_number = f"CUST-{suffix}-{counter}"
            counter += 1

        used.add(serial_number)
        connection.execute(
            customers.update()
            .where(customers.c.id == customer_id)
            .values(serial_number=serial_number)
        )

    with op.batch_alter_table("customers") as batch_op:
        batch_op.alter_column(
            "serial_number",
            existing_type=sa.String(length=50),
            nullable=False,
        )
        batch_op.create_unique_constraint(
            "uq_customers_shop_serial_number",
            ["shop_id", "serial_number"],
        )


def downgrade() -> None:
    with op.batch_alter_table("customers") as batch_op:
        batch_op.drop_constraint(
            "uq_customers_shop_serial_number",
            type_="unique",
        )
        batch_op.drop_index(
            op.f("ix_customers_serial_number"),
        )
        batch_op.drop_column("serial_number")
