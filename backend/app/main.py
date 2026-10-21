from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .config import get_settings
from .db import init_db

app = FastAPI(title=get_settings().app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(router)


def build_api(level_import: Any = None) -> FastAPI:
    """Fábrica para tests: la app se crea ya con las tablas listas en la BD elegida."""
    init_db()
    return app
