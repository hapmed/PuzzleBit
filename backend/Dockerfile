FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

RUN pip install --upgrade pip && pip install \
    "fastapi==0.121.2" "uvicorn[standard]==0.41.0" "sqlalchemy==2.0.45" \
    "alembic==1.17.2" "psycopg[binary]==3.2.13" "pydantic==2.12.5" \
    "pydantic-settings==2.11.0" "python-dotenv==1.2.1"

# El contexto de build es la raíz del repo (compose lo define así).
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./
COPY data ./data

EXPOSE 8000

# DATABASE_URL se inyecta por compose/env; no lleva secreto en la imagen.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
