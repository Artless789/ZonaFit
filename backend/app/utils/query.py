from sqlalchemy import asc, desc
from sqlalchemy.orm import Query

from app.utils.filter import apply_filters
from app.utils.pagination import paginate

__all__ = [
    "paginate",
    "apply_filters",
    "apply_sort",
]


def apply_sort(
    query: Query,
    sort: str | None,
    order: str,
    allowed_fields: dict,
) -> Query:

    if not sort:
        return query

    column = allowed_fields.get(sort)

    if column is None:
        return query

    if order == "desc":
        return query.order_by(desc(column))

    return query.order_by(asc(column))