import importlib
import pkgutil

from sqlalchemy import Enum

import app.models
from app.db import Base

for module in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module(f"app.models.{module.name}")


def test_enum_columns_store_member_values():
    """The migrations create Postgres ENUMs from member values
    ("domain_delegated"); a column storing member names ("DOMAIN_DELEGATED")
    fails on the first insert. Every enum column must use value_enum."""
    enum_columns = [
        column for table in Base.metadata.tables.values() for column in table.columns if isinstance(column.type, Enum)
    ]
    assert enum_columns
    for column in enum_columns:
        assert column.type.enums == [member.value for member in column.type.enum_class], column
