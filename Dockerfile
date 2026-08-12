# ── Stage 1: Frontend build ─────────────────────────────────────────────
FROM node:24-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build --configuration production

# ── Stage 2: Backend deps ───────────────────────────────────────────────
FROM python:3.14-slim AS backend-build
WORKDIR /build
COPY backend/ ./
RUN pip install --no-cache-dir .

# ── Stage 3: Runtime ────────────────────────────────────────────────────
FROM python:3.14-slim
WORKDIR /app
COPY --from=backend-build /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=backend-build /usr/local/bin /usr/local/bin
COPY backend/ ./
COPY --from=frontend-build /build/dist/frontend/browser /app/frontend-dist
ENV FRONTEND_DIST_DIR=/app/frontend-dist
EXPOSE 8000
CMD ["uvicorn", "app:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]
