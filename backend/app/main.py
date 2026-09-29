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
    communications,
    whatsapp_groups,
)

app = FastAPI(
    title="Merwil ZonaFit API",
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
            "detail": "Demasiadas solicitudes. Por favor, espera un momento antes de reintentar.",
            "error": {
                "type": "RateLimitExceeded",
                "message": "Demasiadas solicitudes. Por favor, espera un momento antes de reintentar.",
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


# ── Startup Events ────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_backfill_photos():
    """
    Non-destructive auto-sync: scans if any client has a photo on local disk
    that has not yet been persisted to the client_photos table.
    """
    try:
        from app.database.database import SessionLocal
        from app.services.client_photo_service import sync_orphan_disk_photos_to_db
        db = SessionLocal()
        try:
            sync_orphan_disk_photos_to_db(db)
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Startup photo backfill skipped: %s", e)


from pathlib import Path
_frontend_dist_env = os.getenv("FRONTEND_DIST", "/app/frontend/dist")
_frontend_dist_path = Path(_frontend_dist_env)

if not _frontend_dist_path.is_dir():
    @app.get("/")
    def root():
        return {
            "message": "Bienvenido a Merwil ZonaFit API"
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
app.include_router(communications.router, dependencies=active_sub_dep)
app.include_router(whatsapp_groups.router, dependencies=active_sub_dep)

# ── Static Files & Frontend SPA Routing (Production Container) ─────────────────
if _frontend_dist_path.is_dir():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    _assets_dir = _frontend_dist_path / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    _videos_dir = _frontend_dist_path / "videos"
    if _videos_dir.is_dir():
        app.mount("/videos", StaticFiles(directory=str(_videos_dir)), name="videos")

    _app_index = _frontend_dist_path / "app" / "index.html"
    _web_index = _frontend_dist_path / "index.html"

    # API prefix set to return 404 JSON rather than SPA fallback on nonexistent API endpoints
    _API_PREFIXES = (
        "auth", "clients", "membership-plans", "memberships", "payments",
        "categories", "products", "sales", "sale-details", "inventory-movements",
        "invoices", "invoice-details", "dashboard", "reports", "audit-logs",
        "accounts-receivables", "cash-registers", "users", "notifications",
        "communications", "gym-settings", "superadmin",
        "subscriptions", "health", "readiness", "docs", "redoc", "openapi.json"
    )

    if _app_index.is_file():
        @app.get("/app/{full_path:path}", include_in_schema=False)
        async def serve_app(full_path: str):
            target = _frontend_dist_path / "app" / full_path
            if full_path and target.is_file():
                return FileResponse(target)
            return FileResponse(_app_index)

        @app.get("/app", include_in_schema=False)
        async def serve_app_root():
            return FileResponse(_app_index)

    if _web_index.is_file():
        @app.get("/", include_in_schema=False)
        async def serve_root():
            return FileResponse(_web_index)

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_fallback(request: Request, full_path: str):
            first_segment = full_path.split("/")[0] if full_path else ""
            accept = request.headers.get("accept", "")
            # If the client is explicitly requesting HTML (browser navigation/reload), serve SPA
            if "text/html" in accept:
                file_path = _frontend_dist_path / full_path
                if full_path and file_path.is_file():
                    return FileResponse(file_path)
                return FileResponse(_web_index)

            if first_segment in _API_PREFIXES:
                return JSONResponse(status_code=404, content={"detail": "Not Found"})
            file_path = _frontend_dist_path / full_path
            if full_path and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(_web_index)
