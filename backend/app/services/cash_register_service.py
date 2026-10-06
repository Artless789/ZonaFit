from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy.exc import IntegrityError
from app.models.cash_register import CashRegister
from app.models.cash_movement import CashMovement
from app.models.user import User
from app.schemas.cash_register import (
    CashRegisterCreate,
    CashRegisterClose,
    CashMovementCreate,
    CashRegisterSummaryResponse,
    PaymentMethodSummaryItem,
)
from app.core.database_transaction import DatabaseTransaction
from app.exceptions.business_exception import BusinessException
from datetime import datetime, timedelta, timezone, time
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
        try:
            with DatabaseTransaction(db):
                db.add(register)
                db.flush()
                db.refresh(register)
        except IntegrityError:
            raise ValueError("Ya existe una caja abierta.")
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
    def get_register_summary(
        db: Session,
        current_user: User,
        register_id: int | None = None
    ) -> CashRegisterSummaryResponse:
        from app.models.payment import Payment
        from app.services.dashboard_service import DashboardService

        if register_id:
            register = db.query(CashRegister).filter(
                CashRegister.id == register_id,
                CashRegister.gym_id == current_user.gym_id
            ).first()
        else:
            register = CashRegisterService.get_active(db, current_user.gym_id)

        if not register:
            raise ValueError("Caja no encontrada.")

        # 1. Cash Movements belonging strictly to this register.id
        movements = db.query(CashMovement).filter(
            CashMovement.cash_register_id == register.id,
            CashMovement.gym_id == current_user.gym_id
        ).all()
        
        raw_incomes = sum((m.amount for m in movements if m.type == "IN"), Decimal("0.00"))
        reversal_outcomes = sum((m.amount for m in movements if m.type == "OUT" and m.category == "REVERSAL"), Decimal("0.00"))
        cash_incomes = max(Decimal("0.00"), raw_incomes - reversal_outcomes)
        cash_outcomes = sum((m.amount for m in movements if m.type == "OUT" and m.category != "REVERSAL"), Decimal("0.00"))
        expected_cash = register.opening_balance + raw_incomes - (reversal_outcomes + cash_outcomes)

        # 2. Query Payments strictly within the shift window [opened_at, closed_at]
        start_time = register.opened_at

        other_register_payment_ids = (
            db.query(CashMovement.payment_id)
            .filter(
                CashMovement.gym_id == current_user.gym_id,
                CashMovement.payment_id.isnot(None),
                CashMovement.cash_register_id != register.id,
            )
        )

        payments_query = db.query(
            Payment.payment_method,
            func.sum(Payment.amount).label("total_amount")
        ).filter(
            Payment.gym_id == current_user.gym_id,
            Payment.status == "PAID",
            Payment.is_active == True,
            ~Payment.id.in_(other_register_payment_ids),
        )

        if start_time:
            payments_query = payments_query.filter(Payment.created_at >= start_time)
        if register.status == "CLOSED" and register.closed_at:
            payments_query = payments_query.filter(Payment.created_at <= register.closed_at)

        payments_grouped = payments_query.group_by(Payment.payment_method).all()
        
        METHOD_LABELS = {
            "CASH": "Efectivo",
            "TRANSFER": "Transferencia",
            "TRANSFERENCIA": "Transferencia",
            "CARD": "Tarjeta",
            "TARJETA": "Tarjeta",
            "OTHER": "Otros",
        }

        methods_dict = {}
        for row in payments_grouped:
            raw_method = row.payment_method or "OTHER"
            norm_method = raw_method.upper().strip()
            label = METHOD_LABELS.get(norm_method, norm_method.capitalize())
            amt = Decimal(str(row.total_amount or 0))
            if norm_method in methods_dict:
                methods_dict[norm_method]["registered_amount"] += amt
            else:
                methods_dict[norm_method] = {
                    "method": norm_method,
                    "label": label,
                    "registered_amount": amt
                }

        # Ensure CASH is represented
        if "CASH" not in methods_dict:
            cash_sales_income = max(
                Decimal("0.00"),
                sum(
                    (m.amount for m in movements if m.type == "IN" and m.category in ["SALE", "MEMBERSHIP_PAYMENT", "CREDIT_PAYMENT"]),
                    Decimal("0.00")
                ) - reversal_outcomes
            )
            methods_dict["CASH"] = {
                "method": "CASH",
                "label": "Efectivo",
                "registered_amount": cash_sales_income
            }

        sorted_methods = []
        if "CASH" in methods_dict:
            sorted_methods.append(PaymentMethodSummaryItem(**methods_dict.pop("CASH")))
        for m in sorted(methods_dict.values(), key=lambda x: x["label"]):
            sorted_methods.append(PaymentMethodSummaryItem(**m))

        total_registered_income = sum((item.registered_amount for item in sorted_methods), Decimal("0.00"))

        # 3. Calculate payments collected today BEFORE this shift opened (e.g. pre-shift electronic or earlier closed shift)
        pre_shift_payments_today = Decimal("0.00")
        if start_time:
            gym_tz = DashboardService._get_gym_timezone(db, current_user.gym_id)
            now_local = datetime.now(gym_tz)
            today_start = datetime.combine(now_local.date(), time.min, tzinfo=gym_tz)
            pre_shift_payments_today = (
                db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
                .filter(
                    Payment.gym_id == current_user.gym_id,
                    Payment.status == "PAID",
                    Payment.is_active == True,
                    Payment.created_at >= today_start,
                    Payment.created_at < start_time,
                )
                .scalar()
                or Decimal("0.00")
            )

        return CashRegisterSummaryResponse(
            register_id=register.id,
            status=register.status,
            opened_at=register.opened_at,
            opening_balance=register.opening_balance,
            cash_incomes=cash_incomes,
            cash_outcomes=cash_outcomes,
            expected_cash=expected_cash,
            payment_methods=sorted_methods,
            total_registered_income=total_registered_income,
            pre_shift_payments_today=pre_shift_payments_today,
        )

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
        movements = db.query(CashMovement).filter(
            CashMovement.cash_register_id == register.id,
            CashMovement.gym_id == current_user.gym_id
        ).all()
        incomes = sum((m.amount for m in movements if m.type == "IN"), Decimal("0.00"))
        outcomes = sum((m.amount for m in movements if m.type == "OUT"), Decimal("0.00"))
        
        expected = register.opening_balance + incomes - outcomes
        difference = data.counted_balance - expected

        reconciliation_json = None
        if data.reconciliations:
            import json
            reconciliation_json = json.dumps([
                {
                    "method": r.method,
                    "registered_amount": float(r.registered_amount),
                    "verified_amount": float(r.verified_amount),
                    "difference": float(r.difference),
                    "status": r.status or ("CUADRADO" if r.difference == Decimal("0.00") else ("SOBRANTE" if r.difference > Decimal("0.00") else "FALTANTE"))
                }
                for r in data.reconciliations
            ])

        with DatabaseTransaction(db):
            register.status = "CLOSED"
            register.closed_by = current_user.id
            register.closed_at = datetime.now(timezone.utc)
            register.expected_balance = expected
            register.counted_balance = data.counted_balance
            register.difference = difference
            register.closing_notes = data.closing_notes
            register.reconciliation_data = reconciliation_json
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
