#!/bin/sh
set -e

# Support Hyperlift / PaaS configurable application port
PORT="${APPLICATION_PORT:-${PORT:-8000}}"
WORKERS="${WORKERS:-2}"

echo "================================================="
echo " Starting Merwil ZonaFit Production Application"
echo " Environment: ${ENVIRONMENT:-production}"
echo " Port: ${PORT}"
echo " Workers: ${WORKERS}"
echo "================================================="

# Optional database migration on container start
if [ "${RUN_MIGRATIONS}" = "true" ]; then
    echo "Applying database migrations with Alembic..."
    alembic upgrade head
    echo "Migrations applied successfully."
fi

# Optional automated client import for Primero de Mayo (Requires explicit ALLOW_UNATTENDED_STARTUP_SYNC="true")
if [ "${IMPORT_PRIMERO_DE_MAYO}" = "true" ]; then
    if [ "${ALLOW_UNATTENDED_STARTUP_SYNC}" = "true" ]; then
        echo "================================================="
        echo " Executing Primero de Mayo client import..."
        echo "================================================="
        if [ -f "scripts/import_primero_de_mayo_clients.py" ]; then
            python scripts/import_primero_de_mayo_clients.py
        elif [ -f "backend/scripts/import_primero_de_mayo_clients.py" ]; then
            python backend/scripts/import_primero_de_mayo_clients.py
        else
            echo "ERROR: import_primero_de_mayo_clients.py not found!"
            exit 1
        fi
        echo "Primero de Mayo client import completed successfully."
    else
        echo "NOTICE: IMPORT_PRIMERO_DE_MAYO=true detected but ALLOW_UNATTENDED_STARTUP_SYNC is not set to 'true'. Skipping import on container startup for data protection."
    fi
fi

# Optional automated active memberships import for Primero de Mayo (Requires explicit ALLOW_UNATTENDED_STARTUP_SYNC="true")
if [ "${IMPORT_PRIMERO_DE_MAYO_MEMBERSHIPS}" = "true" ]; then
    if [ "${ALLOW_UNATTENDED_STARTUP_SYNC}" = "true" ]; then
        echo "================================================="
        echo " Executing Primero de Mayo active memberships import..."
        echo "================================================="
        if [ -f "scripts/import_primero_de_mayo_memberships.py" ]; then
            python scripts/import_primero_de_mayo_memberships.py
        elif [ -f "backend/scripts/import_primero_de_mayo_memberships.py" ]; then
            python backend/scripts/import_primero_de_mayo_memberships.py
        else
            echo "ERROR: import_primero_de_mayo_memberships.py not found!"
            exit 1
        fi
        echo "Primero de Mayo active memberships import completed successfully."
    else
        echo "NOTICE: IMPORT_PRIMERO_DE_MAYO_MEMBERSHIPS=true detected but ALLOW_UNATTENDED_STARTUP_SYNC is not set to 'true'. Skipping import on container startup for data protection."
    fi
fi

# Optional automated active memberships sync for MerwilFit (Requires explicit ALLOW_UNATTENDED_STARTUP_SYNC="true")
if [ "${SYNC_MERWILFIT_MEMBERSHIPS}" = "true" ]; then
    if [ "${ALLOW_UNATTENDED_STARTUP_SYNC}" = "true" ]; then
        echo "================================================="
        echo " Executing MerwilFit memberships synchronization..."
        echo "================================================="
        if [ -f "scripts/sync_merwilfit_memberships.py" ]; then
            python scripts/sync_merwilfit_memberships.py --production
        elif [ -f "backend/scripts/sync_merwilfit_memberships.py" ]; then
            python backend/scripts/sync_merwilfit_memberships.py --production
        else
            echo "ERROR: sync_merwilfit_memberships.py not found!"
            exit 1
        fi
        echo "MerwilFit memberships synchronization completed successfully."
    else
        echo "NOTICE: SYNC_MERWILFIT_MEMBERSHIPS=true detected but ALLOW_UNATTENDED_STARTUP_SYNC is not set to 'true'. Skipping sync on container startup for data protection."
    fi
fi

# If custom command arguments are passed, execute them instead
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Ensure client uploads directory exists in persistent storage
mkdir -p "${UPLOADS_DIR:-/app/uploads}/clients"

# Execute FastAPI via Uvicorn ASGI server
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers "${WORKERS}"
