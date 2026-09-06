# ==============================================================================
# Merwil ZonaFit — Production Dockerfile for Hyperlift
# Multi-stage build: Node.js (Frontend Build) + Python (Backend & Static Runner)
# ==============================================================================

# ── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy dependency manifests first for build caching
COPY frontend/package*.json ./

# Install dependencies cleanly
RUN npm ci

# Copy frontend source files
COPY frontend/ ./

# Build arguments for Vite (defaults to relative "" for same-container serving)
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Compile frontend production assets (outputs to /app/frontend/dist)
RUN npm run build


# ── Stage 2: Production Backend & Static Serving ──────────────────────────────
FROM python:3.11-slim AS runner

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python production dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ ./

# Copy compiled frontend from Stage 1 into the container
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Ensure client upload directories exist
RUN mkdir -p /app/uploads/clients

# Copy container entrypoint script and ensure execution permissions
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Production environment configuration
ENV PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    APPLICATION_PORT=8000 \
    FRONTEND_DIST=/app/frontend/dist

# Expose default application port
EXPOSE 8000

# Health check probe against the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request, os; port = os.getenv('APPLICATION_PORT', os.getenv('PORT', '8000')); urllib.request.urlopen(f'http://127.0.0.1:{port}/health')" || exit 1

# Start production server
ENTRYPOINT ["/app/entrypoint.sh"]
