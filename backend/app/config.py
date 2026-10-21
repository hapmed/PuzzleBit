from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BACKEND_DIR / ".env")


def _levels_default() -> Path:
    """data/levels.json: junto al repo en dev (_BACKEND_DIR/../data) o dentro de la imagen (/srv/data)."""
    for base in (_BACKEND_DIR.parent, _BACKEND_DIR):
        p = base / "data" / "levels.json"
        if p.exists():
            return p
    return _BACKEND_DIR.parent / "data" / "levels.json"


class Settings(BaseSettings):
    """Configuración por variables de entorno (la BD se pasa con DATABASE_URL)."""

    app_name: str = "PuzzleBit API"
    database_url: str = "sqlite:///./puzzlebit-dev.db"
    levels_file: Path = _levels_default()
    # Orígenes CORS separados por comas (evita el lío JSON de pydantic-settings).
    cors_origins: str = "https://puzzlebit.hapmed.qzz.io,http://localhost:8086,http://127.0.0.1:8086"

    @property
    def cors_origin_list(self) -> list[str]:
        return [s.strip() for s in self.cors_origins.split(",") if s.strip()]

    model_config = {"env_file": str(_BACKEND_DIR / ".env"), "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
