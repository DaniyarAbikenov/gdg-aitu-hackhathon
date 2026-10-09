FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 career
COPY --chown=career:career app ./app
COPY --chown=career:career migrations ./migrations
COPY --chown=career:career alembic.ini ./

FROM base AS test
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests ./tests
COPY pyproject.toml ./
CMD ["sh", "-c", "alembic upgrade head && pytest --cov=app --cov-report=term-missing"]

FROM base AS runtime
USER career
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)"
# State lives in PostgreSQL and Redis, so workers scale horizontally. The backend is only
# reachable through the Nginx gateway, which overwrites X-Forwarded-For with the client address.
ENV CAREER_WEB_WORKERS=2
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers \"$CAREER_WEB_WORKERS\" --proxy-headers --forwarded-allow-ips '*' --no-access-log"]
