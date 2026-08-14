from sqlalchemy.orm import Query

from app.schemas.pagination import (
    PaginationParams,
    PaginationResponse,
    calculate_total_pages,
)


def paginate(
    query: Query,
    params: PaginationParams,
) -> PaginationResponse:

    total = query.count()

    items = (
        query.offset(params.offset)
        .limit(params.page_size)
        .all()
    )

    return PaginationResponse(
        items=items,
        page=params.page,
        page_size=params.page_size,
        total=total,
        total_pages=calculate_total_pages(
            total,
            params.page_size,
        ),
    )