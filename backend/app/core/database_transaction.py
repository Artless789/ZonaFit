from collections.abc import Callable
from typing import Any

from sqlalchemy.orm import Session


class DatabaseTransaction:

    def __init__(
        self,
        db: Session,
        on_commit: Callable[[], Any] | None = None,
        on_rollback: Callable[[Exception], Any] | None = None,
    ):
        self.db = db
        self.on_commit = on_commit
        self.on_rollback = on_rollback

    def __enter__(self) -> Session:
        return self.db

    def __exit__(
        self,
        exc_type,
        exc_value,
        traceback,
    ) -> bool:

        if exc_type is None:
            self.db.commit()
            if self.on_commit:
                self.on_commit()
        else:
            self.db.rollback()
            if self.on_rollback:
                self.on_rollback(exc_value)

        # We DO NOT close the session here.
        # The session lifecycle is managed by FastAPI Depends(get_db).
        return False