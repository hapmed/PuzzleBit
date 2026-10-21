from __future__ import annotations


def test_health(client) -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_levels_catalog(client) -> None:
    res = client.get("/api/levels")
    assert res.status_code == 200
    payload = res.json()
    ids = [lv["id"] for lv in payload["levels"]]
    assert len(payload["levels"]) == 50
    assert ids[0] == 1


def test_level_detail(client) -> None:
    res = client.get("/api/levels/3")
    assert res.status_code == 200
    assert res.json()["id"] == 3
    assert "objectives" in res.json()


def test_level_missing(client) -> None:
    res = client.get("/api/levels/999")
    assert res.status_code == 404


def test_post_progress_upsert(client) -> None:
    assert client.post("/api/progress", json={"player": "ana", "level_id": 1, "stars": 1, "best_score": 900}).status_code == 200
    assert client.post("/api/progress", json={"player": "ana", "level_id": 1, "stars": 3, "best_score": 2200}).status_code == 200

    res = client.get("/api/progress/ana")
    assert res.status_code == 200
    rows = res.json()["progress"]
    assert len(rows) == 1
    assert rows[0]["stars"] == 3
    assert rows[0]["best_score"] == 2200


def test_progress_invalid_nickname(client) -> None:
    res = client.post("/api/progress", json={"player": "bad!" * 6, "level_id": 1, "stars": 1, "best_score": 10})
    assert res.status_code in (400, 422)


def test_post_score_and_ranking(client) -> None:
    assert client.post("/api/scores", json={"player": "ana", "level_id": 1, "score": 1800, "moves_left": 3}).status_code == 201
    assert client.post("/api/scores", json={"player": "ben", "level_id": 1, "score": 2300, "moves_left": 1}).status_code == 201
    assert client.post("/api/scores", json={"player": "ana", "level_id": 2, "score": 900, "moves_left": 5}).status_code == 201

    res = client.get("/api/ranking")
    assert res.status_code == 200
    total = res.json()["total"]
    # ben suma 2300 en un solo nivel → gana con 2300 + 0? ana tiene 1800 + 900 = 2700>2300.
    assert total[0]["player"] == "ana"
    assert total[0]["score"] == 2700

    res = client.get("/api/ranking", params={"level_id": 1})
    per = res.json()["perLevel"]["1"]
    assert per[0]["player"] == "ben"
    assert per[0]["score"] == 2300


def test_score_endless_level_accepted(client) -> None:
    """Modo infinito: ids fuera de la campaña se aceptan (los genera el cliente)."""
    res = client.post("/api/scores", json={"player": "ana", "level_id": 9999, "score": 100, "moves_left": 1})
    assert res.status_code == 201
    res = client.post("/api/progress", json={"player": "ana", "level_id": 9999, "stars": 2, "best_score": 100})
    assert res.status_code == 200

    # En el ranking por nivel aparecen los infinitos con actividad.
    res = client.get("/api/ranking", params={"level_id": 9999})
    assert res.status_code == 200
    assert res.json()["perLevel"]["9999"][0]["player"] == "ana"

    rows = client.get("/api/progress/ana").json()["progress"]
    assert any(r["level_id"] == 9999 for r in rows)


def test_score_out_of_range_rejected(client) -> None:
    res = client.post("/api/scores", json={"player": "ana", "level_id": 0, "score": 100, "moves_left": 1})
    assert res.status_code in (400, 422)
    res = client.post("/api/scores", json={"player": "ana", "level_id": 100001, "score": 100, "moves_left": 1})
    assert res.status_code in (400, 422)


def test_score_validation(client) -> None:
    res = client.post("/api/scores", json={"player": "ana", "level_id": 1, "score": -5, "moves_left": 1})
    assert res.status_code == 422  # pydantic: ge=0
