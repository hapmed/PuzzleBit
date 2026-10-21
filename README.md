# PuzzleBit

Juego **web de match-3** con estética **pixel art**, niveles, estrellas y ranking.
Instalable como **PWA** en móvil y escritorio.

## Concepto

- Rejilla de caramelos/piezas de colores.
- Intercambia piezas adyacentes para formar líneas de 3 o más.
- Combos en cascada, piezas especiales y objetivos por nivel.
- Campaña de niveles con estrellas y progreso.
- Ranking por nivel y global.
- Sin assets ni nombre de Candy Crush: arte y contenido originales.

## Stack

| Capa | Tecnología |
|---|---|
| Cliente | Phaser 3 · TypeScript · Vite |
| PWA | Manifest · Service Worker · caché offline |
| Backend | FastAPI · SQLAlchemy · Alembic · PostgreSQL |
| Web | Docker · Caddy · Cloudflare Tunnel |
| Arte | Pixel art · piezas 48×48 · UI 8-bit |

## Decisiones cerradas

- **Web + PWA**.
- **Niveles + ranking**.
- **Pixel art**.
- Servidor en el **HomeLab**.
- Base `puzzlebit` en el PostgreSQL existente.

## Documentación

- [`AGENTS.md`](./AGENTS.md) — brief completo para el agente.
- [`ACCESOS.md`](./ACCESOS.md) — servidor, BD, Docker, GitHub, Cloudflare, R2 y SMB.
- [`docs/GAMEPLAY.md`](./docs/GAMEPLAY.md) — mecánicas, niveles y ranking.
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — cliente, API y datos.
- [`docs/ARTE.md`](./docs/ARTE.md) — dirección pixel art.
- [`data/levels.json`](./data/levels.json) — niveles iniciales.

## Estado

**Implementado (Fases 1–4 del MVP):**

- ✅ **Fase 1** — Motor match-3 determinista (`src/game/engine/`: PRNG sembrado, tablero sin matches iniciales, matches (líneas y cuadros 2×2), cascadas, puntuación, reverso de swaps inválidos, reshuffle) + 36 tests de Vitest entre motor y modo infinito. 10 niveles base y victoria/derrota con estrellas. Escenas Phaser: Boot, Preload, Menu, Game, Ranking, Daily. Controles táctiles/ratón/arrastre. Arte pixel 48×48 generado en runtime (sin assets externos).
- ✅ **Fase 2** — PWA instalable (`manifest.webmanifest`, service worker con cache del shell y network-first para la API, iconos 192/512 generados). Audio chiptune generado (`public/audio/`). Piezas especiales: rayada H/V, envuelta (3×3), bomba (color) y combos entre especiales.
- ✅ **Fase 3** — Backend FastAPI + SQLAlchemy 2 + Alembic (`backend/`): health, niveles, progreso (upsert solo mejora), puntuaciones con validación y ranking global/por nivel (incluye modo infinito). Cliente sincroniza con cola offline (`localStorage`) al recuperar conexión. 10 tests de pytest; ruff y mypy limpios.
- ✅ **Fase 4** — 50 niveles (`data/levels.json`, generados con `scripts/gen-levels.cjs`) con objetivos variados: puntuación, recolectar color, limpiar jelly, ingredientes transportables al fondo. Bloqueadores: cajas (daño de especiales) y jelly. Boosters: martillo, mezcla y movimiento extra. Reto diario determinista por fecha. **Modo infinito**: niveles procedurales deterministas (`src/game/endless.ts`) con id > 50, dificultad creciente y ranking aceptado por el backend.

**Juice arcade y formas (2026-10-21):**

- ✅ **Entrada directa**: pantalla INSERT COIN (tap para saltar) → el juego abre en el **último nivel jugado** (o el ∞). Sin pantalla de selección de niveles.
- ✅ **Reglas de rompe con formas**: cuadros 2×2 (→ wrapped), fusiones con líneas (→ bomba con 6+ celdas) y **dado** por dos cuadros pegados (repinta 3×3 y arma cascadas). Combos entre especiales intactos.
- ✅ **Estética de gabinete 90s**: scanlines CRT, ¿LISTO?/¡YA! con fanfarria, chip HI-SCOR, voz de anunciador (es-ES), stingers por cascada, mascota bonus clicable y espectáculos de pantalla (ondas expansivas, barridos, aguaceros, mega-rompe, confeti de victoria).

**Desplegado (HomeLab, 2026-10-21):**

- 🌐 **https://puzzlebit.hapmed.qzz.io** — HTTPS vía Cloudflare Tunnel (`puzzlebit.hapmed.qzz.io` → `:8086` en el host).
- `cd /opt/apps/PuzzleBit/ops && docker compose up -d --build`: `ops-api-1` (FastAPI + Postgres en `apps-net`) y `ops-web-1` (Caddy en `:8086` con el build de Phaser).
- Base `puzzlebit` creada en el PostgreSQL existente; Alembic sellado (schema `0001_init`).
- Backend `ops/compose.yaml`: red interna propia para API/CDN (evita colisión de aliases con otras pilas del HomeLab).

**Cómo jugar (máquina local):**

```bash
npm install
npm run dev        # http://localhost:8086
# build de producción + PWA:
npm run build && npm run preview
```

**Backend local (apiKey opcional):**

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -e . # o uv sync
.venv/bin/uvicorn app.main:app --port 8000
```

Con Docker (requiere Docker en el HomeLab):

```bash
docker compose -f ops/compose.yaml up -d   # Caddy en :8086 + API en red interna
```

## PUERTOS Y DOMINIO

- Web (público): `https://puzzlebit.hapmed.qzz.io` (Cloudflare Tunnel).
- Web local: `127.0.0.1:8086` (Caddy).
- API: `api:8000` (solo red interna del stack).

## Documentación

- [`AGENTS.md`](./AGENTS.md) — brief completo para el agente.
- [`ACCESOS.md`](./ACCESOS.md) — servidor, BD, Docker, GitHub, Cloudflare, R2 y SMB (secretos, no versionar).
- [`docs/GAMEPLAY.md`](./docs/GAMEPLAY.md) — mecánicas, niveles y ranking.
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — cliente, API y datos.
- [`docs/ARTE.md`](./docs/ARTE.md) — dirección pixel art.
- [`data/levels.json`](./data/levels.json) — 50 niveles de campaña.
