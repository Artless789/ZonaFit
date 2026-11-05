import asyncio
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger("zonafit.cash_scheduler")

_scheduler_task: Optional[asyncio.Task] = None
_is_running = False


def run_auto_close_sweep(as_of_time: Optional[datetime] = None) -> int:
    """
    Executes a synchronous sweep closing any expired cash registers across all gyms.
    Returns the total count of registers closed.
    """
    from app.database.database import SessionLocal
    from app.services.cash_register_service import CashRegisterService

    db = SessionLocal()
    try:
        # Enable RLS bypass if supported to inspect all gyms
        db.info["bypass_rls"] = True
        if db.bind and db.bind.dialect.name == "postgresql":
            from sqlalchemy import text
            try:
                db.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            except Exception as e:
                logger.debug("Failed to set app.bypass_rls config: %s", e)

        closed = CashRegisterService.close_expired_registers(db, as_of_time=as_of_time)
        if closed:
            logger.info("Auto-closed %d expired cash register(s).", len(closed))
        return len(closed)
    except Exception as e:
        logger.error("Error running auto-close sweep: %s", e, exc_info=True)
        return 0
    finally:
        db.close()


async def _scheduler_loop(check_interval_seconds: int = 60):
    logger.info("Midnight cash auto-close background scheduler started (interval: %ds).", check_interval_seconds)

    # Immediate catch-up sweep on startup (handles recovery if server was down at midnight)
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, run_auto_close_sweep)
    except Exception as e:
        logger.error("Error in startup catch-up cash close sweep: %s", e, exc_info=True)

    while _is_running:
        try:
            await asyncio.sleep(check_interval_seconds)
            if not _is_running:
                break
            await loop.run_in_executor(None, run_auto_close_sweep)
        except asyncio.CancelledError:
            logger.info("Cash scheduler loop cancelled.")
            break
        except Exception as e:
            logger.error("Unexpected error in cash scheduler loop: %s", e, exc_info=True)


async def start_cash_scheduler(check_interval_seconds: int = 60):
    global _scheduler_task, _is_running
    if _is_running:
        logger.warning("Cash scheduler is already running.")
        return
    _is_running = True
    _scheduler_task = asyncio.create_task(_scheduler_loop(check_interval_seconds))


async def stop_cash_scheduler():
    global _scheduler_task, _is_running
    _is_running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        try:
            await _scheduler_task
        except asyncio.CancelledError:
            pass
    logger.info("Midnight cash scheduler stopped.")
