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

# If custom command arguments are passed, execute them instead
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# Execute FastAPI via Uvicorn ASGI server
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers "${WORKERS}"
