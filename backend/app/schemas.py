from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_SCORE = 10_000_000


def _validate_nickname(v: str) -> str:
    v = v.strip()
    if not v or len(v) > 20:
        raise ValueError("Apodo vacío o demasiado largo")
    if not re.match(r"^[A-Za-z0-9 _-]+$", v):
        raise ValueError("Apodo con caracteres inválidos")
    return v


class PlayerIn(BaseModel):
    """El cliente manda el apodo con la clave `player`."""

    player: str

    @field_validator("player")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        return _validate_nickname(v)


class ProgressIn(PlayerIn):
    level_id: int = Field(ge=1, le=10000)
    stars: int = Field(ge=0, le=3)
    best_score: int = Field(ge=0, le=MAX_SCORE)


class ScoreIn(PlayerIn):
    level_id: int = Field(ge=1, le=10000)
    score: int = Field(ge=0, le=MAX_SCORE)
    moves_left: int = Field(ge=0, le=999)


class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    player_id: int
    level_id: int
    score: int
    moves_left: int
