# ── Stage 1: deps ──────────────────────────────────────────────────────
FROM python:3.14-slim AS deps

WORKDIR /app

# Install build deps, copy project metadata, install dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir . \
    && pip install --no-cache-dir uvicorn[standard]

# ── Stage 2: production ────────────────────────────────────────────────
FROM python:3.14-slim AS production

# Create non-root user
RUN groupadd -r nordicpump --gid 1001 \
    && useradd -r -g nordicpump --uid 1001 --home-dir /app nordicpump

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code (owned by non-root user)
COPY --chown=nordicpump:nordicpump . .

# Create cache directory with correct ownership
RUN mkdir -p /app/cache && chown nordicpump:nordicpump /app/cache

USER nordicpump

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8000"]
