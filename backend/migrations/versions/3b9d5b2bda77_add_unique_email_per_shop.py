
"""add unique email per shop

Revision ID: 3b9d5b2bda77
Revises: cb221cd32fff
Create Date: 2026-11-14 17:34:47.860315
"""

from typing import Sequence, Union

from alembic import op


revision: str = "3b9d5b2bda77"
down_revision: Union[str, Sequence[str], None] = "cb221cd32fff"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_users_shop_email",
        "users",
        ["shop_id", "email"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_users_shop_email",
        "users",
        type_="unique",
    )
