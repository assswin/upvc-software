
"""enforce measurement shop ownership

Revision ID: cb221cd32fff
Revises: ab941abd4c77
Create Date: 2026-11-14 17:22:13.798471
"""

from typing import Sequence, Union

from alembic import op


revision: str = "cb221cd32fff"
down_revision: Union[str, Sequence[str], None] = "ab941abd4c77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow projects to be referenced using both id and shop_id.
    op.create_unique_constraint(
        "uq_projects_id_shop_id",
        "projects",
        ["id", "shop_id"],
    )

    # Replace the old project-only relationship.
    op.drop_constraint(
        "measurements_project_id_fkey",
        "measurements",
        type_="foreignkey",
    )

    # Ensure a measurement belongs to the same shop as its project.
    op.create_foreign_key(
        "fk_measurements_project_shop",
        "measurements",
        "projects",
        ["project_id", "shop_id"],
        ["id", "shop_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_measurements_project_shop",
        "measurements",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "measurements_project_id_fkey",
        "measurements",
        "projects",
        ["project_id"],
        ["id"],
    )

    op.drop_constraint(
        "uq_projects_id_shop_id",
        "projects",
        type_="unique",
    )
