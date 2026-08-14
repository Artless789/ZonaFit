from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.auth import require_active_subscription

from app.exceptions.handlers import register_exception_handlers
from app.middleware.rate_limiter import limiter
from app.routers import (
    auth,
    audit_logs,
    categories,
    clients,
    dashboard,
    gym_settings,
    inventory_movements,
    invoice_details,
    invoices,
    membership_plans,
    memberships,
    notifications,
    payments,
    products,
    reports,
    sale_details,
    sales,
    superadmin,
    subscriptions,
    accounts_receivables,
    cash_registers,
    users,
)

app = FastAPI(
    title="ZonaFit API",
    version="1.0.0",
)

# ── Rate Limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "type": "RateLimitExceeded",
                "message": "Too many requests. Please slow down and try again later.",
                "status_code": 429,
                "path": str(request.url.path),
            },
        },
    )


app.add_middleware(SlowAPIMiddleware)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    # CSP is primarily enforced in the frontend index.html or reverse proxy, but added here for API endpoints
    # response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    from app.core.config import settings
    if settings.ENVIRONMENT.lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

import os

# ── CORS ───────────────────────────────────────────────────────────────────────
from app.core.config import settings
allowed_origins = [url.strip().rstrip('/') for url in settings.FRONTEND_URLS.split(",") if url.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception Handlers ─────────────────────────────────────────────────────────
register_exception_handlers(app)


@app.get("/")
def root():
    return {
        "message": "Bienvenido a ZonaFit API"
    }

@app.get("/health")
def health_check():
    """Liveness probe — application is running."""
    return {"status": "ok", "service": "zonafit-api"}

@app.get("/readiness")
def readiness_check():
    """Readiness probe — application + database are accessible."""
    from app.database.database import engine
    from sqlalchemy import text as sa_text
    try:
        with engine.connect() as conn:
            conn.execute(sa_text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "unavailable"

    ready = db_status == "ok"
    return {
        "status": "ready" if ready else "not_ready",
        "db": db_status,
    }


# ── Routers ────────────────────────────────────────────────────────────────────
# Unprotected by subscription (but protected by auth inside)
app.include_router(auth.router)
app.include_router(gym_settings.router)
app.include_router(superadmin.router)
app.include_router(subscriptions.router)

# Protected by subscription
active_sub_dep = [Depends(require_active_subscription)]

app.include_router(clients.router, dependencies=active_sub_dep)
app.include_router(membership_plans.router, dependencies=active_sub_dep)
app.include_router(memberships.router, dependencies=active_sub_dep)
app.include_router(payments.router, dependencies=active_sub_dep)
app.include_router(categories.router, dependencies=active_sub_dep)
app.include_router(products.router, dependencies=active_sub_dep)
app.include_router(sales.router, dependencies=active_sub_dep)
app.include_router(sale_details.router, dependencies=active_sub_dep)
app.include_router(inventory_movements.router, dependencies=active_sub_dep)
app.include_router(invoices.router, dependencies=active_sub_dep)
app.include_router(invoice_details.router, dependencies=active_sub_dep)
app.include_router(dashboard.router, dependencies=active_sub_dep)
app.include_router(reports.router, dependencies=active_sub_dep)
app.include_router(audit_logs.router, dependencies=active_sub_dep)
app.include_router(accounts_receivables.router, dependencies=active_sub_dep)
app.include_router(cash_registers.router, dependencies=active_sub_dep)
app.include_router(users.router, dependencies=active_sub_dep)
app.include_router(notifications.templates_router, dependencies=active_sub_dep)
app.include_router(notifications.notifications_router, dependencies=active_sub_dep)