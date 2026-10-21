from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")


class Settings(BaseSettings):
    """Configuración por variables de entorno (la BD se pasa con DATABASE_URL)."""

    app_name: str = "PuzzleBit API"
    database_url: str = "sqlite:///./puzzlebit-dev.db"
    levels_file: Path = _BACKEND_DIR.parent / "data" / "levels.json"
    cors_origins: list[str] = [
        "https://puzzlebit.hapmed.qzz.io",
        "http://localhost:8086",
        "http://127.0.0.1:8086",
    ]

    model_config = {"env_file": str(_BACKEND_DIR / ".env"), "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
