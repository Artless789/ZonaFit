from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_audit_access
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
        "Supports filtering by action, module, entity_type, user_id, date range, and free search. "
        "Default order: newest first. Requires audit view permissions."
    ),
)
def get_audit_logs(
    action: Optional[str] = Query(
        default=None,
        description="Filter by action type (CREATE, UPDATE, DELETE, LOGIN, etc.)",
    ),
    module: Optional[str] = Query(
        default=None,
        description="Filter by module (MEMBERSHIPS, CLIENTS, SALES, PAYMENTS, INVENTORY, CASH_REGISTER, SETTINGS, USERS, AUTH)",
    ),
    entity_type: Optional[str] = Query(
        default=None,
        description="Filter by entity type (GymSettings, Client, Sale, etc.)",
    ),
    user_id: Optional[int] = Query(
        default=None,
        description="Filter by user ID who performed the action.",
    ),
    search: Optional[str] = Query(
        default=None,
        description="Free text search in description, entity name, user name or action.",
    ),
    start_date: Optional[datetime] = Query(
        default=None,
        description="Start date filter (inclusive)",
    ),
    end_date: Optional[datetime] = Query(
        default=None,
        description="End date filter (inclusive)",
    ),
    params: PaginationParams = Depends(),
    sort: SortParams = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_audit_access),
):
    return AuditService.get_all(
        db=db,
        current_user=current_user,
        sort=sort,
        params=params,
        action=action,
        module=module,
        entity_type=entity_type,
        user_id=user_id,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/{log_id}",
    response_model=AuditLogResponse,
    summary="Get audit log entry",
    description="Returns a single audit log entry by ID. Requires audit view permissions.",
)
def get_audit_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_audit_access),
):
    entry = AuditService.get_by_id(db, current_user, log_id)

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log entry not found.",
        )

    return entry
