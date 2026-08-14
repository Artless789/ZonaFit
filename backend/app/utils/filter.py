from sqlalchemy import or_
from sqlalchemy.orm import Query

from app.schemas.filter import FilterParams


def apply_filters(
    query: Query,
    filters: FilterParams,
    search_fields: list,
) -> Query:

    if filters.search:

        query = query.filter(
            or_(
                *[
                    field.ilike(f"%{filters.search}%")
                    for field in search_fields
                ]
            )
        )

    return query