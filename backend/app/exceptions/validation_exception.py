from app.exceptions.base_exception import BaseAppException


class ValidationException(BaseAppException):

    def __init__(self, message: str):
        super().__init__(
            message=message,
            status_code=422,
        )