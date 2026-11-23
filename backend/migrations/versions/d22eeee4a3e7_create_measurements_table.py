
"""create measurements table

Revision ID: d22eeee4a3e7
Revises: d91465a60dd3
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d22eeee4a3e7"
down_revision: Union[str, Sequence[str], None] = "d91465a60dd3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "measurements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("shop_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("row_order", sa.Integer(), nullable=False),
        sa.Column(
            "height",
            sa.Numeric(precision=12, scale=4),
            nullable=True,
        ),
        sa.Column(
            "width",
            sa.Numeric(precision=12, scale=4),
            nullable=True,
        ),
        sa.Column("model_id", sa.String(length=20), nullable=True),
        sa.Column("glass_type", sa.String(length=100), nullable=True),
        sa.Column(
            "tolerance_mm",
            sa.Numeric(precision=10, scale=3),
            nullable=False,
        ),
        sa.Column("apply_tolerance", sa.Boolean(), nullable=False),
        sa.Column(
            "height_additional_mm",
            sa.Numeric(precision=10, scale=3),
            nullable=False,
        ),
        sa.Column(
            "width_additional_mm",
            sa.Numeric(precision=10, scale=3),
            nullable=False,
        ),
        sa.Column(
            "identification_color",
            sa.String(length=20),
            nullable=False,
        ),
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
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
        ),
        sa.ForeignKeyConstraint(
            ["shop_id"],
            ["shops.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        op.f("ix_measurements_project_id"),
        "measurements",
        ["project_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_measurements_shop_id"),
        "measurements",
        ["shop_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_index(
        op.f("ix_measurements_shop_id"),
        table_name="measurements",
    )

    op.drop_index(
        op.f("ix_measurements_project_id"),
        table_name="measurements",
    )

    op.drop_table("measurements")
