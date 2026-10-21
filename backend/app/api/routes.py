from __future__ import annotations

import json
import re
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Player, Progress, Score
from ..schemas import ProgressIn, ScoreIn

router = APIRouter(prefix="/api")

VALID_NICK = re.compile(r"^[A-Za-z0-9 _-]{1,20}$")

# Modo infinito: ids > campaña generados en el cliente (deterministas por id).
ENDLESS_MAX = 100000


def _valid_level_id(level_id: int) -> bool:
    """Id de campaña o de nivel infinito (determinista en el cliente)."""
    return 1 <= level_id <= ENDLESS_MAX


@lru_cache
def _levels_cached() -> dict[int, dict[str, Any]]:
    data = json.loads(get_settings().levels_file.read_text(encoding="utf-8"))
    return {lv["id"]: lv for lv in data["levels"]}


def ensure_player(db: Session, nickname: str) -> Player:
    if not VALID_NICK.match(nickname):
        raise HTTPException(status_code=400, detail="Apodo inválido")
    player = db.scalar(select(Player).where(Player.nickname == nickname))
    if player:
        return player
    player = Player(nickname=nickname)
    db.add(player)
    db.commit()
    db.refresh(player)
    return player


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/levels")
async def list_levels() -> dict[str, Any]:
    return {"levels": list(_levels_cached().values())}


@router.get("/levels/{level_id}")
async def get_level(level_id: int) -> dict[str, Any]:
    level = _levels_cached().get(level_id)
    if not level:
        raise HTTPException(status_code=404, detail="Nivel no encontrado")
    return level


@router.post("/progress")
async def post_progress(payload: ProgressIn, db: Session = Depends(get_db)):
    """Guarda el progreso de un nivel (upsert: solo mejora)."""
    if not _valid_level_id(payload.level_id):
        raise HTTPException(status_code=400, detail="Nivel fuera de rango")
    player = ensure_player(db, payload.player)
    existing = db.scalar(
        select(Progress).where(Progress.player_id == player.id, Progress.level_id == payload.level_id),
    )
    if existing is None:
        db.add(
            Progress(
                player_id=player.id,
                level_id=payload.level_id,
                stars=payload.stars,
                best_score=payload.best_score,
            )
        )
    else:
        existing.stars = max(int(str(existing.stars)), int(payload.stars))
        existing.best_score = max(int(str(existing.best_score)), int(payload.best_score))
    db.commit()
    return {"ok": True}


@router.get("/progress/{nickname}")
async def get_progress(nickname: str, db: Session = Depends(get_db)):
    player = db.scalar(select(Player).where(Player.nickname == nickname))
    if not player:
        return {"progress": []}
    rows = db.execute(select(Progress).where(Progress.player_id == player.id)).scalars().all()
    return {
        "progress": [
            {"level_id": r.level_id, "stars": int(r.stars), "best_score": int(r.best_score), "completed": r.completed_at is not None}
            for r in rows
        ]
    }


@router.post("/scores", status_code=201)
async def post_score(payload: ScoreIn, db: Session = Depends(get_db)):
    player = ensure_player(db, payload.player)
    if payload.score < 0:
        raise HTTPException(status_code=400, detail="Puntuación inválida")
    if not _valid_level_id(payload.level_id):
        raise HTTPException(status_code=400, detail="Nivel inexistente")
    db.add(Score(player_id=player.id, level_id=payload.level_id, score=payload.score, moves_left=payload.moves_left))
    db.commit()
    return {"ok": True}


@router.get("/ranking")
async def ranking(level_id: int | None = None, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Ranking global (suma de mejores por nivel) y por nivel. Escala doméstica: en memoria."""
    rows = db.execute(
        select(Player.nickname, Score.level_id, Score.score).join(Score, Score.player_id == Player.id)
    ).all()
    bests: dict[str, dict[int, int]] = {}
    for nickname, lid, sc in rows:
        entry = bests.setdefault(str(nickname), {})
        entry[int(lid)] = max(entry.get(int(lid), 0), int(str(sc)))

    level_ids = sorted(_levels_cached().keys())
    per_level: dict[str, list[dict[str, Any]]] = {}

    def entries_for(target: int) -> list[tuple[str, int]]:
        pairs = [(nick, scores.get(target, 0)) for nick, scores in bests.items() if scores.get(target, 0) > 0]
        return sorted(pairs, key=lambda p: -p[1])[:50]

    def to_list(pairs: list[tuple[str, int]]) -> list[dict[str, Any]]:
        return [{"player": nick, "score": score} for nick, score in pairs]

    if level_id is not None:
        if not _valid_level_id(level_id):
            raise HTTPException(status_code=404, detail="Nivel no encontrado")
        per_level[str(level_id)] = to_list(entries_for(level_id))
    else:
        for lid in level_ids:
            per_level[str(lid)] = to_list(entries_for(lid))
        # Niveles infinitos con actividad también van al ranking por nivel.
        campaign_max = max(level_ids) if level_ids else 0
        played_endless = sorted({lid for scores in bests.values() for lid in scores if lid > campaign_max})
        for lid in played_endless[:200]:
            per_level[str(lid)] = to_list(entries_for(lid))

    totals = sorted(
        ((nick, sum(scores.values())) for nick, scores in bests.items() if scores),
        key=lambda p: -p[1],
    )
    return {"total": to_list(totals)[:50], "perLevel": per_level}
