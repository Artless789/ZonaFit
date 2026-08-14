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

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def calculate_total_pages(
    total: int,
    page_size: int,
) -> int:

    if total == 0:
        return 0

    return ceil(total / page_size)