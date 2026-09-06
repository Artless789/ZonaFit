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
    limit = getattr(params, "effective_limit", params.page_size)
    offset = getattr(params, "effective_offset", params.offset)
    page = getattr(params, "effective_page", params.page)

    items = (
        query.offset(offset)
        .limit(limit)
        .all()
    )

    return PaginationResponse(
        items=items,
        page=page,
        page_size=limit,
        total=total,
        total_pages=calculate_total_pages(
            total,
            limit,
        ),
    )