from typing import Literal

from pydantic import BaseModel


class FilterParams(BaseModel):

    search: str | None = None

    status: str | None = None

    sort: str | None = None

    order: Literal["asc", "desc"] = "asc"