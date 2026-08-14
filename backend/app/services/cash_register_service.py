from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.user import User
from app.schemas.cash_register import CashRegisterCreate, CashRegisterClose, CashMovementCreate
from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from datetime import datetime
from zoneinfo import ZoneInfo

class CashRegisterService:
    @staticmethod
    def get_active(db: Session, gym_id: int) -> CashRegister:
        return (
            db.query(CashRegister)
            .filter(
                CashRegister.gym_id == gym_id,
                CashRegister.status == "OPEN"
            )
            .first()
        )

    @staticmethod
    def open_register(db: Session, current_user: User, data: CashRegisterCreate) -> CashRegister:
        active = CashRegisterService.get_active(db, current_user.gym_id)
        if active:
            raise ValueError("Ya existe una caja abierta.")

        register = CashRegister(
            gym_id=current_user.gym_id,
            opened_by=current_user.id,
            opening_balance=data.opening_balance,
            status="OPEN"
        )
        with DatabaseTransaction(db):
            db.add(register)
            db.flush()
            db.refresh(register)
        return register

    @staticmethod
    def add_movement(db: Session, current_user: User, register: CashRegister, amount: Decimal, type: str, category: str, description: str = None, payment_id: int = None) -> CashMovement:
        if register.status != "OPEN":
            raise ValueError("La caja no está abierta.")
        
        if amount < 0:
            raise ValueError("El monto no puede ser negativo.")

        movement = CashMovement(
            gym_id=current_user.gym_id,
            cash_register_id=register.id,
            payment_id=payment_id,
            amount=amount,
            type=type,
            category=category,
            description=description,
            created_by=current_user.id
        )
        db.add(movement)
        db.flush()
        return movement

    @staticmethod
    def create_manual_movement(db: Session, current_user: User, data: CashMovementCreate) -> CashMovement:
        active = CashRegisterService.get_active(db, current_user.gym_id)
        if not active:
            raise ValueError("No hay una caja abierta para registrar este movimiento.")

        if data.type not in ["IN", "OUT"]:
            raise ValueError("Tipo inválido. Use IN o OUT.")

        with DatabaseTransaction(db):
            movement = CashRegisterService.add_movement(
                db=db,
                current_user=current_user,
                register=active,
                amount=data.amount,
                type=data.type,
                category=data.category,
                description=data.description
            )
            db.refresh(movement)
            return movement

    @staticmethod
    def close_register(db: Session, current_user: User, register_id: int, data: CashRegisterClose) -> CashRegister:
        register = db.query(CashRegister).filter(
            CashRegister.id == register_id,
            CashRegister.gym_id == current_user.gym_id
        ).first()

        if not register:
            raise ValueError("Caja no encontrada.")

        if register.status != "OPEN":
            raise ValueError("La caja ya está cerrada.")

        # Calculate expected balance
        movements = db.query(CashMovement).filter(CashMovement.cash_register_id == register.id).all()
        incomes = sum(m.amount for m in movements if m.type == "IN")
        outcomes = sum(m.amount for m in movements if m.type == "OUT")
        
        expected = register.opening_balance + incomes - outcomes
        difference = data.counted_balance - expected

        with DatabaseTransaction(db):
            register.status = "CLOSED"
            register.closed_by = current_user.id
            register.closed_at = func.now()
            register.expected_balance = expected
            register.counted_balance = data.counted_balance
            register.difference = difference
            register.closing_notes = data.closing_notes
            db.flush()
            db.refresh(register)
        
        return register

    @staticmethod
    def get_all(db: Session, gym_id: int):
        return db.query(CashRegister).filter(CashRegister.gym_id == gym_id).order_by(CashRegister.opened_at.desc()).all()

    @staticmethod
    def get_movements(db: Session, register_id: int, gym_id: int):
        return db.query(CashMovement).filter(
            CashMovement.cash_register_id == register_id,
            CashMovement.gym_id == gym_id
        ).order_by(CashMovement.created_at.asc()).all()
