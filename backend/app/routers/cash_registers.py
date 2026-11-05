from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_cash_operation, require_cash_history
from app.database.database import get_db
from app.models.user import User
from app.schemas.cash_register import (
    CashRegisterResponse,
    CashRegisterSummaryResponse,
    CashRegisterCreate,
    CashRegisterClose,
    CashMovementResponse,
    CashMovementCreate
)
from app.services.cash_register_service import CashRegisterService
from app.constants.permissions import Permission, user_has_permission
from app.core.idempotency import IdempotentRoute

router = APIRouter(
    prefix="/cash-registers",
    tags=["Cash Registers"],
    route_class=IdempotentRoute
)

@router.get("/active", response_model=CashRegisterResponse)
def get_active_register(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    register = CashRegisterService.get_active(db, current_user.gym_id)
    if not register:
        raise HTTPException(status_code=404, detail="No hay una caja abierta.")
    return register

@router.get("/active/summary", response_model=CashRegisterSummaryResponse)
def get_active_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_operation),
):
    try:
        return CashRegisterService.get_register_summary(db, current_user)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{register_id}/summary", response_model=CashRegisterSummaryResponse)
def get_register_summary(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify if caller is authorized: either has history permission or is querying the active register
    active_reg = CashRegisterService.get_active(db, current_user.gym_id)
    if not (active_reg and active_reg.id == register_id):
        if not user_has_permission(current_user, Permission.VIEW_CASH_HISTORY):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes autorización para consultar arqueos de cajas históricas.",
            )

    try:
        return CashRegisterService.get_register_summary(db, current_user, register_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/open", response_model=CashRegisterResponse, status_code=status.HTTP_201_CREATED)
def open_register(
    data: CashRegisterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_operation),
):
    try:
        return CashRegisterService.open_register(db, current_user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{register_id}/close", response_model=CashRegisterResponse)
def close_register(
    register_id: int,
    data: CashRegisterClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_operation),
):
    try:
        return CashRegisterService.close_register(db, current_user, register_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/movements", response_model=CashMovementResponse, status_code=status.HTTP_201_CREATED)
def create_manual_movement(
    data: CashMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_operation),
):
    try:
        return CashRegisterService.create_manual_movement(db, current_user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[CashRegisterResponse])
def get_all_registers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_history),
):
    return CashRegisterService.get_all(db, current_user.gym_id)

@router.get("/{register_id}/movements", response_model=List[CashMovementResponse])
def get_movements(
    register_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_cash_operation),
):
    return CashRegisterService.get_movements(db, register_id, current_user.gym_id)
