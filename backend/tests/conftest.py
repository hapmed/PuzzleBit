"""Fixtures de tests: SQLite temporal con las mismas tablas."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from app.db import init_db
from app.main import app


@pytest.fixture
def client(tmp_path):
    db_path = tmp_path / "test.db"
    test_url = f"sqlite:///{db_path}"
    # Inyecta la BD de test antes de crear tablas/sesiones.
    import app.db as db_mod

    db_mod._engine = create_engine(test_url)
    db_mod._SessionLocal = None
    init_db()
    with TestClient(app) as c:
        yield c
    db_mod._engine = None
    db_mod._SessionLocal = None
