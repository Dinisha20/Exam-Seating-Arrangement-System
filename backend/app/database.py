"""database.py — SQLAlchemy engine/session setup.

Reads DATABASE_URL from the environment (set in docker-compose.yml).
Falls back to a local Postgres connection string for running the backend
directly (outside Docker) during development.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Try local Postgres first; if unavailable, seamlessly fall back to local SQLite
    pg_url = "postgresql://postgres:postgres@localhost:5432/exam_seating"
    try:
        test_engine = create_engine(pg_url, pool_pre_ping=True)
        with test_engine.connect() as conn:
            pass
        DATABASE_URL = pg_url
    except Exception:
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "exam_seating.db"))
        DATABASE_URL = f"sqlite:///{db_path}"

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
