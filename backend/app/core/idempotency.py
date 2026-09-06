import json
from typing import Callable
from fastapi import Request, Response
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.models.idempotency_key import IdempotencyKey
from app.core.security import verify_access_token

class IdempotentRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            idempotency_key = request.headers.get("Idempotency-Key")
            
            if not idempotency_key or request.method not in ["POST", "PUT", "PATCH"]:
                return await original_route_handler(request)

            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return await original_route_handler(request)
            
            token = auth_header.split(" ")[1]
            payload = verify_access_token(token)
            if not payload or "user_id" not in payload:
                return await original_route_handler(request)
                
            user_id = payload["user_id"]
            gym_id = payload.get("gym_id")
            
            # Superadmin no-gym bypass
            if not gym_id and payload.get("role", "").upper() == "SUPERADMIN":
                gym_id = 0
            elif not gym_id:
                return await original_route_handler(request)
            
            db: Session = SessionLocal()
            try:
                existing_key = db.query(IdempotencyKey).filter(
                    IdempotencyKey.idempotency_key == idempotency_key,
                    IdempotencyKey.user_id == user_id,
                    IdempotencyKey.gym_id == gym_id
                ).first()
                
                if existing_key:
                    # Devuelve la respuesta parseada
                    return Response(
                        content=json.dumps(existing_key.response_body),
                        status_code=existing_key.response_status,
                        media_type="application/json"
                    )
            finally:
                db.close()

            # Ejecutar request
            response: Response = await original_route_handler(request)

            # Extraer body si es posible (fastapi genera JSONResponse típicamente)
            if hasattr(response, "body"):
                try:
                    response_body = json.loads(response.body.decode("utf-8"))
                except (ValueError, UnicodeDecodeError):
                    response_body = {}
            else:
                response_body = {}

            # Solo registrar respuestas existosas o conflictos de negocio (ej. 400, 409) 
            # No registrar 500 (para permitir reintentos por errores del servidor)
            # No registrar 401 (token expirado)
            if response.status_code < 500 and response.status_code != 401:
                db_write = SessionLocal()
                try:
                    new_idem = IdempotencyKey(
                        idempotency_key=idempotency_key,
                        user_id=user_id,
                        gym_id=gym_id,
                        response_status=response.status_code,
                        response_body=response_body
                    )
                    db_write.add(new_idem)
                    db_write.commit()
                except Exception:
                    db_write.rollback()
                finally:
                    db_write.close()

            return response

        return custom_route_handler
