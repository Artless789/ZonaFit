from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginationResponse(
    BaseModel,
    Generic[T],
):

    model_config = ConfigDict(
        from_attributes=True,
    )

    items: list[T]

    page: int

    page_size: int

    total: int

    total_pages: int


class PaginationParams(BaseModel):

    page: int = 1

    page_size: int = 20

    limit: int | None = None

    skip: int | None = None

    @property
    def effective_limit(self) -> int:
        if self.limit is not None and self.limit > 0:
            return self.limit
        return self.page_size

    @property
    def effective_offset(self) -> int:
        if self.skip is not None and self.skip >= 0:
            return self.skip
        return (self.page - 1) * self.page_size

    @property
    def offset(self) -> int:
        return self.effective_offset

    @property
    def effective_page(self) -> int:
        if self.skip is not None and self.limit is not None and self.limit > 0:
            return (self.skip // self.limit) + 1
        return self.page


def calculate_total_pages(
    total: int,
    page_size: int,
) -> int:

    if total == 0:
        return 0

    if page_size <= 0:
        return 1

    return ceil(total / page_size)