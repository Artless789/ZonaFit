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

import os
import threading

_close_lock = threading.Lock()

class CashRegisterService:
    @staticmethod
    def calculate_expected_cash(db: Session, register: CashRegister) -> Decimal:
        """Calculates total expected cash in drawer based on opening balance and valid movements."""
        movements = db.query(CashMovement).filter(
            CashMovement.cash_register_id == register.id,
            CashMovement.gym_id == register.gym_id
        ).all()
        incomes = sum((m.amount for m in movements if m.type == "IN"), Decimal("0.00"))
        outcomes = sum((m.amount for m in movements if m.type == "OUT"), Decimal("0.00"))
        return register.opening_balance + incomes - outcomes

    @staticmethod
    def close_expired_registers(
        db: Session,
        target_gym_id: int | None = None,
        as_of_time: datetime | None = None
    ) -> list[CashRegister]:
        """
        Automatically closes cash registers that remained open past midnight (00:00 local time)
        based on each gym's configured timezone. Idempotent, transaction-safe and concurrency-protected.
        """
        from app.models.gym import Gym
        from app.models.gym_settings import GymSettings
        from app.models.user import User
        from app.services.audit_service import AuditService
        from app.constants.audit_actions import AuditAction, AuditModule
        from app.constants.permissions import Role
        import json
        import logging

        logger = logging.getLogger("zonafit.cash_register_service")

        with _close_lock:
            if target_gym_id:
                gyms = db.query(Gym).filter(Gym.id == target_gym_id).all()
            else:
                gyms = db.query(Gym).filter(Gym.is_active == True).all()

            closed_registers: list[CashRegister] = []
            is_pg = db.bind and db.bind.dialect.name == "postgresql"

            for gym in gyms:
                # Advisory lock on PostgreSQL per gym to avoid concurrent closures by different workers
                if is_pg:
                    from sqlalchemy import text
                    try:
                        lock_acquired = db.execute(
                            text("SELECT pg_try_advisory_xact_lock(hashtext(:key))"),
                            {"key": f"cash_close_gym_{gym.id}"}
                        ).scalar()
                        if not lock_acquired:
                            continue
                    except Exception as e:
                        logger.debug("Advisory lock check skipped/failed: %s", e)

                # Resolve gym timezone (default America/Bogota)
                settings = db.query(GymSettings).filter(GymSettings.gym_id == gym.id).first()
                tz_str = (settings.timezone if settings and settings.timezone else os.getenv("DEFAULT_TIMEZONE", "America/Bogota")).strip()
                try:
                    gym_tz = ZoneInfo(tz_str)
                except Exception:
                    gym_tz = ZoneInfo("America/Bogota")

                # Reference time
                ref_time = as_of_time if as_of_time else datetime.now(timezone.utc)
                now_local = ref_time.astimezone(gym_tz)
                today_start_local = datetime.combine(now_local.date(), time.min, tzinfo=gym_tz)
                today_start_utc = today_start_local.astimezone(timezone.utc)

                # Query open registers opened prior to today's midnight in gym timezone
                query = (
                    db.query(CashRegister)
                    .filter(
                        CashRegister.gym_id == gym.id,
                        CashRegister.status == "OPEN",
                        CashRegister.opened_at < today_start_utc
                    )
                )
                if is_pg:
                    query = query.with_for_update(skip_locked=True)

                expired_registers = query.all()

                try:
                    for reg in expired_registers:
                        if reg.status != "OPEN":
                            continue

                        expected_balance = CashRegisterService.calculate_expected_cash(db, reg)

                        reg_opened_local = reg.opened_at.astimezone(gym_tz)
                        shift_end_local = datetime.combine(reg_opened_local.date() + timedelta(days=1), time.min, tzinfo=gym_tz)
                        shift_end_utc = shift_end_local.astimezone(timezone.utc)
                        closing_time = min(shift_end_utc, ref_time.astimezone(timezone.utc))

                        # Cash movement summary for reconciliation record without physical count
                        movements = db.query(CashMovement).filter(
                            CashMovement.cash_register_id == reg.id,
                            CashMovement.gym_id == reg.gym_id
                        ).all()
                        cash_incomes = sum((m.amount for m in movements if m.type == "IN" and m.category in ["SALE", "MEMBERSHIP_PAYMENT", "CREDIT_PAYMENT"]), Decimal("0.00"))
                        reversals = sum((m.amount for m in movements if m.type == "OUT" and m.category == "REVERSAL"), Decimal("0.00"))
                        net_cash_sales = max(Decimal("0.00"), cash_incomes - reversals)

                        reconciliation_json = json.dumps([
                            {
                                "method": "CASH",
                                "registered_amount": float(net_cash_sales),
                                "verified_amount": None,
                                "difference": None,
                                "status": "SIN_ARQUEO_FISICO"
                            }
                        ])

                        reg.status = "CLOSED"
                        reg.close_type = "AUTOMATIC"
                        reg.closed_by = None
                        reg.closed_at = closing_time
                        reg.expected_balance = expected_balance
                        reg.counted_balance = None
                        reg.difference = None
                        reg.closing_notes = "Cierre autom\u00e1tico por finalizaci\u00f3n de jornada (00:00). Pendiente de arqueo f\u00edsico."
                        reg.reconciliation_data = reconciliation_json
                        db.flush()

                        # Audit log
                        AuditService.log(
                            db=db,
                            gym_id=reg.gym_id,
                            action=AuditAction.CASH_REGISTER_CLOSED,
                            module=AuditModule.CASH_REGISTER,
                            entity_type="CashRegister",
                            entity_id=reg.id,
                            entity_name=f"Caja #{reg.id}",
                            user_id=None,
                            user_name="Sistema (Autom?tico)",
                            description=(
                                f"Sistema ejecut? cierre autom?tico de caja #{reg.id} por finalizaci?n de jornada (00:00). "
                                f"Efectivo esperado: ${expected_balance:,.0f} (Sin conteo f?sico)."
                            ),
                            old_values={"status": "OPEN"},
                            new_values={
                                "status": "CLOSED",
                                "close_type": "AUTOMATIC",
                                "expected_balance": str(expected_balance),
                                "counted_balance": None,
                                "difference": None,
                                "closed_at": str(closing_time),
                                "reason": "Cierre autom?tico por finalizaci?n de jornada",
                            },
                        )

                        # Queue notification in same transaction
                        target_phone = settings.official_phone if settings and settings.official_phone else None
                        if target_phone:
                            try:
                                from app.models.notification import Notification
                                from app.constants.notification_statuses import NotificationStatus
                                notification = Notification(
                                    gym_id=reg.gym_id,
                                    event_type="CASH_AUTO_CLOSED",
                                    channel="WHATSAPP",
                                    recipient=target_phone,
                                    message_body=(
                                        f"Aviso Merwil ZonaFit: La caja #{reg.id} fue cerrada autom?ticamente "
                                        f"al finalizar la jornada (00:00). Efectivo esperado por sistema: ${expected_balance:,.0f}. "
                                        f"Recuerde realizar el arqueo f?sico correspondiente."
                                    ),
                                    status=NotificationStatus.PENDING,
                                )
                                db.add(notification)
                            except Exception as ex:
                                logger.warning("Error queueing auto-close notification: %s", ex)

                        closed_registers.append(reg)

                    if expired_registers:
                        db.commit()
                except Exception as ex:
                    db.rollback()
                    logger.error("Error auto-closing registers for gym %s: %s", gym.id, ex)
                    raise

            return closed_registers

    @staticmethod
    def get_active(db: Session, gym_id: int) -> CashRegister | None:
        # Just-in-time check to close any register whose day already ended
        CashRegisterService.close_expired_registers(db, target_gym_id=gym_id)
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
        CashRegisterService.close_expired_registers(db, target_gym_id=current_user.gym_id)
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

                from app.services.audit_service import AuditService
                from app.constants.audit_actions import AuditAction, AuditModule
                AuditService.log(
                    db=db,
                    gym_id=current_user.gym_id,
                    action=AuditAction.CASH_REGISTER_OPENED,
                    module=AuditModule.CASH_REGISTER,
                    entity_type="CashRegister",
                    entity_id=register.id,
                    entity_name=f"Caja #{register.id}",
                    user_id=current_user.id,
                    user_name=current_user.full_name,
                    description=f"{current_user.full_name} realizó apertura de caja #{register.id} con base de ${register.opening_balance:,.0f}",
                    new_values={
                        "register_id": register.id,
                        "opening_balance": str(register.opening_balance),
                    },
                )
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
            from app.services.audit_service import AuditService
            from app.constants.audit_actions import AuditAction, AuditModule
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=AuditAction.CASH_MOVEMENT_CREATED,
                module=AuditModule.CASH_REGISTER,
                entity_type="CashMovement",
                entity_id=movement.id,
                entity_name=f"Movimiento #{movement.id}",
                user_id=current_user.id,
                user_name=current_user.full_name,
                description=f"{current_user.full_name} registró movimiento de caja ({movement.type}: ${movement.amount:,.0f}) - {movement.description or movement.category}",
                new_values={
                    "cash_register_id": active.id,
                    "type": movement.type,
                    "category": movement.category,
                    "amount": str(movement.amount),
                    "description": movement.description,
                },
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
            register.close_type = "MANUAL"
            register.closed_by = current_user.id
            register.closed_at = datetime.now(timezone.utc)
            register.expected_balance = expected
            register.counted_balance = data.counted_balance
            register.difference = difference
            register.closing_notes = data.closing_notes
            register.reconciliation_data = reconciliation_json
            db.flush()

            from app.services.audit_service import AuditService
            from app.constants.audit_actions import AuditAction, AuditModule
            AuditService.log(
                db=db,
                gym_id=current_user.gym_id,
                action=AuditAction.CASH_REGISTER_CLOSED,
                module=AuditModule.CASH_REGISTER,
                entity_type="CashRegister",
                entity_id=register.id,
                entity_name=f"Caja #{register.id}",
                user_id=current_user.id,
                user_name=current_user.full_name,
                description=f"{current_user.full_name} realizó cierre de caja #{register.id} (Efectivo contado: ${register.counted_balance:,.0f}, Diferencia: ${register.difference:,.0f})",
                old_values={"status": "OPEN"},
                new_values={
                    "status": "CLOSED",
                    "expected_balance": str(expected),
                    "counted_balance": str(data.counted_balance),
                    "difference": str(difference),
                    "closing_notes": data.closing_notes,
                },
            )
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
