# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /frontend
COPY frontend-react/package.json ./
RUN npm install
COPY frontend-react/ ./
RUN npm run build

# --- Stage 2: Python backend, serving the built frontend ---
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini .

# Built React app from stage 1 — served as static files by FastAPI.
# main.py resolves this as one level up from the app/ package dir.
COPY --from=frontend-build /frontend/dist /app/frontend_dist

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
