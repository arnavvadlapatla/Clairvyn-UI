# ──────────────────────────────────────────────────────────────
#  ClairvynAI — Production Dockerfile
#  Single container: Flask API served via Gunicorn.
#  Async generation uses ThreadPoolExecutor (no Celery/Redis).
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System deps for psycopg2, ezdxf, matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc g++ libffi-dev \
        libfreetype6-dev libpng-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps — cached layer (invalidated only when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY src/ src/
COPY app.py gunicorn.conf.py auth.py firebase_init.py ./
COPY firebase_key.json ./

# Static assets that the AI pipeline needs at runtime
COPY data/ data/

# Writable directories for generated files and SQLite fallback
RUN mkdir -p data/generated data/checkpoints instance

# Default env vars (overridden at runtime via docker-compose / EC2 env)
ENV FLASK_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "src.app:create_app()"]
