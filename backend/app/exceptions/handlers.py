from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.exceptions.base_exception import BaseAppException


import logging
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

def register_exception_handlers(app: FastAPI):

    @app.exception_handler(BaseAppException)
    async def base_exception_handler(
        request: Request,
        exc: BaseAppException,
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "type": exc.__class__.__name__,
                    "message": exc.message,
                    "status_code": exc.status_code,
                    "path": str(request.url.path),
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request,
        exc: StarletteHTTPException,
    ):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": str(exc.detail),
                "error": {
                    "type": "HTTPException",
                    "message": str(exc.detail),
                    "status_code": exc.status_code,
                    "path": str(request.url.path),
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ):
        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": {
                    "type": "RequestValidationError",
                    "message": "Invalid request parameters",
                    "details": jsonable_encoder(exc.errors()),
                    "status_code": 422,
                    "path": str(request.url.path),
                },
            },
        )

    @app.exception_handler(Exception)
    async def unexpected_exception_handler(
        request: Request,
        exc: Exception,
    ):
        logger.error(f"Unexpected error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "type": "InternalServerError",
                    "message": "An unexpected error occurred.",
                    "status_code": 500,
                    "path": str(request.url.path),
                },
            },
        )