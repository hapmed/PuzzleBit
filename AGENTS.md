# AGENTS.md — PuzzleBit

Guía obligatoria para el agente que programe este proyecto.

## 0. Regla de oro

- Trabaja **solo** dentro de `/proyectos/PuzzleBit`.
- **No** toques otros proyectos ni las bases `hapmed` / `evas_admin`.
- Los secretos están en [`ACCESOS.md`](./ACCESOS.md): úsalos, **no los versiones**,
  no los pegues en logs ni en el chat.
- GitHub: cuenta **`hapmed`** (credencial en `/root/.git-credentials`).
  `hector1516` es solo para consultas de lectura.
- Nada de assets, nombres ni sonidos de Candy Crush. Todo original.

## 1. Qué es

**PuzzleBit** es un juego web de **match-3** con estética **pixel art**:
intercambias piezas adyacentes, formas líneas de 3 o más, encadenas cascadas y
completas objetivos por nivel. Tiene campaña, estrellas y ranking. Es instalable
como **PWA**.

## 2. Decisiones cerradas

| Tema | Decisión |
|---|---|
| Plataforma | Web + PWA |
| Cliente | Phaser 3 + TypeScript + Vite |
| Backend | FastAPI + SQLAlchemy + Alembic + PostgreSQL |
| Hosting | HomeLab (`192.168.0.14`) |
| Puerto web | `127.0.0.1:8086` |
| Dominio | `puzzlebit.hapmed.qzz.io` |
| BD | `puzzlebit` en el PostgreSQL existente |
| Arte | Pixel art, piezas 48×48 |
| Modo | Niveles + estrellas + ranking |

## 3. Arquitectura

```
Navegador / PWA (Phaser 3)
        │ HTTPS
        ▼
Caddy :8086
   ├── /        → build estático de Phaser
   └── /api/*   → FastAPI :8000
                        │
                        └── PostgreSQL existente (puzzlebit)
```

- El cliente corre el tablero y la lógica de juego.
- El backend guarda progreso, niveles desbloqueados, estrellas y ranking.
- Sin WebSocket: no hace falta tiempo real en el MVP.
- PWA: service worker cachea el shell y los niveles; el progreso se sincroniza
  cuando hay conexión.

## 4. Motor match-3

El motor debe ser **determinista** y estar separado del renderizado.

- Rejilla configurable (8×8 por defecto).
- 6 tipos de pieza como máximo.
- Intercambio solo entre piezas adyacentes.
- Un intercambio es válido solo si genera al menos un match.
- Si no hay match, se revierte con animación.
- Match: 3+ piezas iguales en línea horizontal o vertical.
- Eliminación, caída de piezas y relleno desde arriba.
- Cascadas: repetir hasta que no haya matches.
- Detección de tablero sin movimientos → reshuffle automático.
- Puntuación: base por pieza, bonus por cascada y por pieza especial.
- Semilla (`seed`) por nivel para reproducibilidad y pruebas.

### Piezas especiales (fase 2)

- **Rayada horizontal/vertical:** limpia una fila o columna.
- **Envuelta:** explota en área 3×3.
- **Bomba:** combina con otra especial.
- Combinaciones de especiales con efectos claros.
- No implementar todo de golpe: primero match-3 básico y cascadas.

## 5. Niveles

- Datos en [`data/levels.json`](./data/levels.json).
- Esquema:

```json
{
  "id": 1,
  "name": "Primer bocado",
  "seed": 101,
  "rows": 8,
  "cols": 8,
  "types": 5,
  "moves": 20,
  "objectives": [{ "type": "score", "target": 1000 }],
  "stars": [1000, 2000, 3000],
  "blockers": []
}
```

- Objetivos iniciales: puntuación.
- Objetivos posteriores: recolectar N piezas, limpiar celdas, llevar ingredientes.
- Estrellas según puntuación.
- Desbloqueo secuencial.
- 10 niveles en el MVP; 30–50 después.
- El cliente y el backend validan que el nivel exista y que el progreso sea coherente.

## 6. PWA

- `manifest.webmanifest`: nombre `PuzzleBit`, `display: standalone`, iconos 192/512.
- Service worker: cachea shell, assets y niveles; estrategia network-first para API.
- Instalable en iOS, Android, Windows y macOS.
- Funciona offline con los niveles ya cargados.
- Progreso pendiente en IndexedDB/localStorage y sincronización al volver online.
- Botón de instalación cuando el navegador lo permita.

## 7. Backend

### API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Salud |
| `GET` | `/api/levels` | Catálogo de niveles |
| `GET` | `/api/levels/{id}` | Nivel concreto |
| `POST` | `/api/progress` | Guardar progreso/estrellas |
| `GET` | `/api/progress/{player}` | Progreso del jugador |
| `POST` | `/api/scores` | Enviar puntuación |
| `GET` | `/api/ranking` | Ranking global y por nivel |

### Datos

- `players`: id, nickname, created_at, last_seen_at.
- `progress`: player_id, level_id, stars, best_score, completed_at.
- `scores`: player_id, level_id, score, moves_left, created_at.
- `levels`: opcional; pueden vivir en JSON y servirse desde el backend.

### Identidad

- MVP: **nickname** sin contraseña, guardado en el navegador.
- Más adelante: cuenta real si hace falta.
- El ranking es para la casa; no hace falta anti-cheat fuerte.
- Validar rangos de puntuación y longitud de nickname en servidor.

## 8. Arte y UI

- Pixel art, piezas de **48×48** px.
- 6 colores/formas distinguibles también en daltonismo.
- Animaciones: idle, selección, swap, match, caída, especial, victoria.
- Fondo pixel con parallax suave.
- UI: mapa de niveles, estrellas, movimientos, objetivo, puntuación, ranking.
- Responsive: vertical en móvil, horizontal en escritorio.
- Controles: ratón, arrastre táctil y teclado opcional.
- Audio: efectos cortos y música loop opcional.
- Nada de assets de Candy Crush.

## 9. Estructura esperada

```
PuzzleBit/
├─ ACCESOS.md
├─ AGENTS.md
├─ README.md
├─ .gitignore
├─ data/levels.json
├─ src/
│  ├─ main.ts
│  ├─ game/
│  │  ├─ scenes/{Boot,Preload,Menu,LevelMap,Game,Result,Ranking}.ts
│  │  ├─ engine/{board,match,cascade,score,random}.ts
│  │  ├─ objects/{Piece,BoardView,Hud}.ts
│  │  └─ config.ts
│  ├─ api/client.ts
│  └─ pwa/
├─ public/{icons,audio}/
├─ backend/
│  ├─ app/{main.py,api/,models/,db/}
│  ├─ alembic/
│  ├─ tests/
│  ├─ pyproject.toml
│  └─ Dockerfile
├─ ops/{compose.yaml,Caddyfile}
└─ docs/{GAMEPLAY.md,ARQUITECTURA.md,ARTE.md}
```

## 10. Fases

### Fase 1 — Match-3 jugable
- Proyecto Vite + Phaser + TypeScript.
- Tablero 8×8, swap, match, cascada, relleno.
- Puntuación y movimientos.
- 10 niveles desde `data/levels.json`.
- Victoria/derrota y estrellas.
- Responsive y controles táctiles.
- Tests del motor (matches, cascadas, swaps inválidos, reshuffle).

### Fase 2 — PWA y presentación
- Manifest, service worker, iconos.
- Mapa de niveles y progreso local.
- Animaciones, partículas y audio.
- Piezas especiales.

### Fase 3 — Backend y ranking
- FastAPI + PostgreSQL.
- Sincronización de progreso.
- Ranking por nivel y global.
- Nickname y sesión local.

### Fase 4 — Contenido
- 30–50 niveles.
- Objetivos variados y bloqueadores.
- Boosters.
- Reto diario.

## 11. Aceptación de Fase 1

- [ ] El juego carga en el navegador desde `http://localhost:8086`.
- [ ] El tablero 8×8 se genera sin matches iniciales.
- [ ] Intercambiar piezas válidas produce match y cascada.
- [ ] Intercambios inválidos se revierten.
- [ ] Se puede ganar/perder un nivel y ver estrellas.
- [ ] Los 10 niveles se leen desde `data/levels.json`.
- [ ] Funciona con ratón y táctil.
- [ ] Tests del motor pasan.
- [ ] No hay secretos en Git.

## 12. Verificación

```bash
npm install
npm run check
npm run test
npm run build

cd backend && uv sync && uv run ruff check . && uv run mypy app && uv run pytest

docker compose -f ops/compose.yaml config
```

Si el entorno no tiene Node/Python, usar Docker o el servidor. **No reportar como
verificado lo que no se ejecutó.**

## 13. Seguridad

- Nickname acotado; sin HTML.
- Validar puntuaciones y niveles en el servidor.
- Sin secretos en el cliente.
- `.env` y `ACCESOS.md` en `.gitignore`.
- Dependencias con versión fija.
- Sin `eval` de datos externos.

## 14. Bloqueos conocidos

- Node y Python no están instalados en el contenedor de opencode; usar Docker o
  el HomeLab.
- Falta crear la base `puzzlebit`.
- Falta configurar el DNS.
- El repo `hapmed/PuzzleBit` se crea con esta entrega.

## 15. Reporte al terminar

1. Qué se implementó y qué no.
2. Archivos creados/modificados.
3. Comandos ejecutados y salida real.
4. Cómo se probó el juego y la PWA.
5. Bloqueos y siguiente paso.
