from collections.abc import Iterator

import sqlalchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


def _make_engine(database_url: str) -> sqlalchemy.Engine:
    return create_engine(database_url, pool_pre_ping=True)


_engine: sqlalchemy.Engine | None = None
_SessionLocal: sessionmaker[Session] | None = None


class Base(DeclarativeBase):
    pass


def get_engine() -> sqlalchemy.Engine:
    global _engine
    if _engine is None:
        _engine = _make_engine(get_settings().database_url)
    return _engine


def get_sessionmaker() -> sessionmaker[Session]:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _SessionLocal


def init_db() -> None:
    """Crea las tablas si no existen (en producción se usa Alembic)."""
    from . import models  # noqa: F401

    Base.metadata.create_all(get_engine())


def get_db() -> Iterator[Session]:
    db = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()
