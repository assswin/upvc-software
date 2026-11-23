
"""add measurement units and millimeter dimensions

Revision ID: a736c2e84f03
Revises: 3b9d5b2bda77
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a736c2e84f03"
down_revision: Union[str, Sequence[str], None] = "3b9d5b2bda77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add the new columns as nullable temporarily.
    op.add_column(
        "measurements",
        sa.Column("input_unit", sa.String(length=5), nullable=True),
    )

    op.add_column(
        "measurements",
        sa.Column(
            "height_mm",
            sa.Numeric(precision=12, scale=4),
            nullable=True,
        ),
    )

    op.add_column(
        "measurements",
        sa.Column(
            "width_mm",
            sa.Numeric(precision=12, scale=4),
            nullable=True,
        ),
    )

    # 2. Backfill existing measurements using their project's
    # currently saved input unit.
    op.execute(
        sa.text("""
            UPDATE measurements AS m
            SET
                input_unit = p.input_unit,

                height_mm = CASE
                    WHEN m.height IS NULL THEN NULL
                    WHEN p.input_unit = 'in' THEN m.height * 25.4
                    WHEN p.input_unit = 'cm' THEN m.height * 10
                    WHEN p.input_unit = 'mm' THEN m.height
                END,

                width_mm = CASE
                    WHEN m.width IS NULL THEN NULL
                    WHEN p.input_unit = 'in' THEN m.width * 25.4
                    WHEN p.input_unit = 'cm' THEN m.width * 10
                    WHEN p.input_unit = 'mm' THEN m.width
                END

            FROM projects AS p
            WHERE
                p.id = m.project_id
                AND p.shop_id = m.shop_id
        """)
    )

    # 3. Make the original input unit mandatory.
    op.alter_column(
        "measurements",
        "input_unit",
        existing_type=sa.String(length=5),
        nullable=False,
    )


def downgrade() -> None:
    op.drop_column("measurements", "width_mm")
    op.drop_column("measurements", "height_mm")
    op.drop_column("measurements", "input_unit")
