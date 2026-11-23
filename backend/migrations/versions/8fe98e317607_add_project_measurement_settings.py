
"""add project measurement settings

Revision ID: 8fe98e317607
Revises: d22eeee4a3e7
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8fe98e317607"
down_revision: Union[str, Sequence[str], None] = "d22eeee4a3e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.add_column(
        "projects",
        sa.Column(
            "input_unit",
            sa.String(length=10),
            nullable=False,
            server_default=sa.text("'in'"),
        ),
    )

    op.add_column(
        "projects",
        sa.Column(
            "output_unit",
            sa.String(length=10),
            nullable=False,
            server_default=sa.text("'mm'"),
        ),
    )

    op.add_column(
        "projects",
        sa.Column(
            "default_tolerance_mm",
            sa.Numeric(precision=10, scale=3),
            nullable=False,
            server_default=sa.text("5"),
        ),
    )

    op.add_column(
        "projects",
        sa.Column(
            "default_apply_tolerance",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Remove database defaults after existing records are populated.
    op.alter_column(
        "projects",
        "input_unit",
        server_default=None,
    )

    op.alter_column(
        "projects",
        "output_unit",
        server_default=None,
    )

    op.alter_column(
        "projects",
        "default_tolerance_mm",
        server_default=None,
    )

    op.alter_column(
        "projects",
        "default_apply_tolerance",
        server_default=None,
    )


def downgrade() -> None:
    """Downgrade schema."""

    op.drop_column("projects", "default_apply_tolerance")
    op.drop_column("projects", "default_tolerance_mm")
    op.drop_column("projects", "output_unit")
    op.drop_column("projects", "input_unit")
