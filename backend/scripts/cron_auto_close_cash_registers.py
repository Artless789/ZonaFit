import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.cash_scheduler import run_auto_close_sweep

if __name__ == "__main__":
    count = run_auto_close_sweep()
    print(f"[CRON] Auto-closed {count} expired cash register(s).")
