from typing import Literal

from pydantic import BaseModel


class SortParams(BaseModel):

    sort: str | None = None
    order: Literal["asc", "desc"] = "asc"
