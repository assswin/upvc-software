import unittest
import uuid
from decimal import Decimal

from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.routes.measurements import (
    batch_create_measurements,
    get_measurements,
)
from app.db.base import Base
from app.models.customer import Customer
from app.models.measurement import Measurement
from app.models.project import Project
from app.models.shop import Shop
from app.schemas.customer import CustomerCreate
from app.schemas.measurement import MeasurementBatchCreate


class MeasurementBatchSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        event.listen(
            self.engine,
            "connect",
            lambda connection, _: connection.execute(
                "PRAGMA foreign_keys=ON"
            ),
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        self.shop = Shop(
            id=uuid.uuid4(),
            name="Test shop",
            slug=f"test-{uuid.uuid4()}",
        )
        self.customer = Customer(
            id=uuid.uuid4(),
            shop_id=self.shop.id,
            name="Test customer",
            serial_number=f"CUST-{uuid.uuid4()}",
        )
        self.project = Project(
            id=uuid.uuid4(),
            shop_id=self.shop.id,
            customer_id=self.customer.id,
            serial_number=f"PROJ-{uuid.uuid4()}",
            name="Test measurements",
            status="active",
            input_unit="in",
            output_unit="mm",
            default_tolerance_mm=Decimal("5"),
            default_apply_tolerance=True,
        )
        self.db.add(self.shop)
        self.db.commit()
        self.db.add(self.customer)
        self.db.commit()
        self.db.add(self.project)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def item(
        self,
        measurement_id: uuid.UUID,
        row_order: int,
        variant_letter: str,
        height: str,
    ) -> dict[str, object]:
        return {
            "id": measurement_id,
            "row_order": row_order,
            "height": Decimal(height),
            "width": Decimal("40"),
            "input_unit": "in",
            "model_id": "58-2",
            "variant_letter": variant_letter,
            "glass_type": "5mm_single",
            "tolerance_mm": Decimal("5"),
            "apply_tolerance": True,
            "height_additional_mm": Decimal("0"),
            "width_additional_mm": Decimal("0"),
            "identification_color": "#FDE68A",
            "status": "pending",
        }

    def synchronize(
        self,
        measurements: list[dict[str, object]],
        delete_ids: list[uuid.UUID] | None = None,
    ) -> list[Measurement]:
        payload = MeasurementBatchCreate(
            measurements=measurements,
            delete_ids=delete_ids or [],
        )
        return batch_create_measurements(
            self.project.id,
            payload,
            self.db,
            self.shop,
        )

    def test_repeated_saves_update_rows_and_preserve_unsubmitted_rows(self) -> None:
        row_ids = [uuid.uuid4() for _ in range(3)]
        initial = [
            self.item(row_ids[0], 1, "", "60"),
            self.item(row_ids[1], 2, "a", "60"),
            self.item(row_ids[2], 3, "b", "60"),
        ]

        created = self.synchronize(initial)
        self.assertEqual([row.id for row in created], row_ids)

        changed = [
            self.item(row_ids[0], 1, "", "60"),
            self.item(row_ids[1], 2, "a", "60"),
            self.item(row_ids[2], 3, "b", "65"),
        ]
        updated = self.synchronize(changed)
        self.assertEqual([row.id for row in updated], row_ids)
        self.assertEqual(updated[0].height, Decimal("60"))
        self.assertEqual(updated[1].height, Decimal("60"))
        self.assertEqual(updated[2].height, Decimal("65"))

        repeated = self.synchronize(changed)
        persisted = list(
            self.db.scalars(
                select(Measurement).where(
                    Measurement.project_id == self.project.id
                )
            ).all()
        )
        self.assertEqual([row.id for row in repeated], row_ids)
        self.assertEqual(len(persisted), 3)
        retrieved = get_measurements(
            self.project.id,
            self.db,
            self.shop,
        )
        self.assertEqual([row.id for row in retrieved], row_ids)
        self.assertEqual(
            [row.variant_letter for row in retrieved],
            ["", "a", "b"],
        )
        self.assertEqual(retrieved[2].height, Decimal("65"))

        self.synchronize([changed[0]])
        persisted_ids = set(
            self.db.scalars(
                select(Measurement.id).where(
                    Measurement.project_id == self.project.id
                )
            ).all()
        )
        self.assertEqual(persisted_ids, set(row_ids))
        self.assertEqual(
            self.db.execute(text("PRAGMA foreign_key_check")).all(),
            [],
        )

    def test_only_explicit_delete_ids_remove_rows(self) -> None:
        row_ids = [uuid.uuid4() for _ in range(2)]
        rows = [
            self.item(row_ids[0], 1, "", "60"),
            self.item(row_ids[1], 2, "a", "60"),
        ]
        self.synchronize(rows)

        remaining = self.synchronize([rows[0]], delete_ids=[row_ids[1]])

        self.assertEqual([row.id for row in remaining], [row_ids[0]])
        persisted_ids = list(
            self.db.scalars(
                select(Measurement.id).where(
                    Measurement.project_id == self.project.id
                )
            ).all()
        )
        self.assertEqual(persisted_ids, [row_ids[0]])

    def test_customer_phone_validation_remains_exactly_ten_digits(self) -> None:
        CustomerCreate(name="Valid customer", phone="1234567890")

        for phone in ("123456789", "12345678901", "12345abcde"):
            with self.subTest(phone=phone):
                with self.assertRaises(ValueError):
                    CustomerCreate(name="Invalid customer", phone=phone)


if __name__ == "__main__":
    unittest.main()
