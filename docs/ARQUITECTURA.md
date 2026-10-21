# Arquitectura — PuzzleBit

## Vista general

```
Navegador / PWA
   Phaser 3 + TypeScript
        │ HTTPS
        ▼
Caddy :8086
   ├── /        → build estático
   └── /api/*   → FastAPI :8000
                        │
                        └── PostgreSQL (puzzlebit)
```

## Cliente

- **Phaser 3** con escenas: Boot, Preload, Menu, LevelMap, Game, Result, Ranking.
- Motor match-3 separado del render:
  - `board.ts`: estado de la rejilla.
  - `match.ts`: detección de líneas.
  - `cascade.ts`: eliminación, caída y relleno.
  - `score.ts`: puntos y estrellas.
  - `random.ts`: PRNG con semilla.
- El motor debe poder probarse sin Phaser.
- Animaciones con tweens; partículas para matches y especiales.
- Responsive con escala y orientación.

## Backend

- FastAPI + SQLAlchemy 2 + Alembic.
- Endpoints: niveles, progreso, puntuaciones y ranking.
- Nickname local; sin contraseña en el MVP.
- Validación de nivel, puntuación y longitud de nickname.
- CORS solo para el dominio del juego.

## Datos

- `players`: id, nickname, created_at, last_seen_at.
- `progress`: player_id, level_id, stars, best_score, completed_at.
- `scores`: player_id, level_id, score, moves_left, created_at.
- `levels`: JSON servido por el backend o empaquetado en el cliente.

## PWA

- Manifest con iconos 192/512.
- Service worker:
  - precache del shell y assets.
  - cache-first para assets.
  - network-first para API.
- Progreso offline en IndexedDB/localStorage.
- Sincronización al recuperar conexión.

## Despliegue

- `/opt/apps/PuzzleBit` en el HomeLab.
- `docker compose up -d`.
- Caddy en `127.0.0.1:8086`.
- API solo en la red interna.
- Cloudflare Tunnel para el dominio.
- Backups de PostgreSQL.
