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

## Puertos y dominio

- Web: `127.0.0.1:8086`.
- API: `api:8000` (solo red interna).
- Dominio: `puzzlebit.hapmed.qzz.io`.
- Repo: `hapmed/PuzzleBit`.

## Documentación

- [`AGENTS.md`](./AGENTS.md) — brief completo para el agente.
- [`ACCESOS.md`](./ACCESOS.md) — servidor, BD, Docker, GitHub, Cloudflare, R2 y SMB.
- [`docs/GAMEPLAY.md`](./docs/GAMEPLAY.md) — mecánicas, niveles y ranking.
- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md) — cliente, API y datos.
- [`docs/ARTE.md`](./docs/ARTE.md) — dirección pixel art.
- [`data/levels.json`](./data/levels.json) — niveles iniciales.

## Estado

Especificación y niveles base listos. **Implementación pendiente.**
