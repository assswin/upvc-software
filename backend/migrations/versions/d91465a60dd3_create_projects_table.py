
"""create projects table

Revision ID: d91465a60dd3
Revises: 895aefdd347f
Create Date: 2026-11-14 16:08:57.823908
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d91465a60dd3"
down_revision: Union[str, Sequence[str], None] = "895aefdd347f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("shop_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_projects_customer_id"),
        "projects",
        ["customer_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_projects_shop_id"),
        "projects",
        ["shop_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f("ix_projects_shop_id"),
        table_name="projects",
    )

    op.drop_index(
        op.f("ix_projects_customer_id"),
        table_name="projects",
    )

    op.drop_table("projects")
