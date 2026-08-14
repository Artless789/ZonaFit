from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_admin
from app.database.database import get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.schemas.pagination import PaginationParams, PaginationResponse
from app.schemas.sort import SortParams
from app.services.audit_service import AuditService

router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"],
)


@router.get(
    "/",
    response_model=PaginationResponse[AuditLogResponse],
    summary="List audit logs",
    description=(
        "Returns paginated audit logs for the authenticated gym. "
        "Supports filtering by action, entity_type and user_id. "
        "Default order: newest first. Requires admin role."
    ),
)
def get_audit_logs(
    action: Optional[str] = Query(
        default=None,
        description="Filter by action type (CREATE, UPDATE, DELETE, LOGIN, etc.)",
    ),
    entity_type: Optional[str] = Query(
        default=None,
        description="Filter by entity type (GymSettings, Client, Sale, etc.)",
    ),
    user_id: Optional[int] = Query(
        default=None,
        description="Filter by user ID who performed the action.",
    ),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return AuditService.get_all(
        db=db,
        current_user=current_user,
        sort=sort,
        params=params,
        action=action,
        entity_type=entity_type,
        user_id=user_id,
    )


@router.get(
    "/{log_id}",
    response_model=AuditLogResponse,
    summary="Get audit log entry",
    description="Returns a single audit log entry by ID. Requires admin role.",
)
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    entry = AuditService.get_by_id(db, current_user, log_id)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log entry not found.",
        )

    return entry
