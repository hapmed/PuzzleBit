/**
 * Modo infinito: niveles con id > campaña generados de forma determinista.
 * Misma semilla → mismo nivel, así que "Nivel ∞ N" es reproducible y Justo.
 */
import { Rng, deriveSeed } from "./engine/random";
import type { LevelDef, Objective, BlockerSpec } from "./levels";

/** Rango de profundidad válido (evita ids absurdos). */
export const ENDLESS_MAX = 100000;

/** Rota nombres (cortos, ≤ 12 chars, original: nada de Candy Crush). */
const NAMES = [
  "Bucle base",
  "Píxel doble",
  "Rebote ácido",
  "Salto cuántico",
  "Nudo binario",
  "Onda cuadrada",
  "Cascada x2",
  "Maze de bits",
  "Motoremacs",
].map((n) => n.slice(0, 12));

/**
 * Genera el nivel infinito nº `id` (id > campaignLength). Determinista:
 * dos llamadas con el mismo id devuelven exactamente el mismo nivel.
 */
export function createEndlessLevel(id: number, campaignLength: number): LevelDef {
  if (id <= campaignLength || id > ENDLESS_MAX) {
    throw new Error(`createEndlessLevel: id ${id} fuera de rango (> ${campaignLength}, ≤ ${ENDLESS_MAX})`);
  }
  const d = id - campaignLength; // profundidad
  const rng = new Rng(deriveSeed(id, 0x1a4e));
  const tier = Math.floor(d / 10);

  // Tablero pequeño al inicio, 8×8 siempre después.
  const rows = d <= 3 && rng.next() < 0.4 ? 7 : 8;
  const cols = rows;
  // Tipos: piesas parciales según profundidad (máximo 6, según AGENTS).
  const types = d < 6 ? 5 : d < 18 ? 5 + rng.int(2) : 6;

  // ——— objetivos ———
  const rotation = d % 3;
  const objectives: Objective[] = [];
  let stars: [number, number, number];

  if (rotation === 0) {
    // Puntuación pura que escala.
    const target = Math.round((1400 + d * 430 + tier * 150) / 50) * 50;
    objectives.push({ kind: "score", target });
    stars = scoreStars(target, d);
  } else if (rotation === 1 && d >= 12) {
    // Ingredientes (campaña dura desde lvl 12+ del modo infinito).
    const count = 1 + Math.min(2, Math.floor((d - 12) / 9));
    const every = Math.max(5, 8 - tier);
    objectives.push({ kind: "ingredient", ref: 0, target: count });
    objectives.push({ kind: "score", target: Math.round((1800 + d * 300) / 50) * 50 });
    stars = scoreStars(2800 + d * 520, d);
    return finalize(id, d, rng, rows, cols, types, objectives, stars, [], { count, every });
  } else if (rotation === 1) {
    // Recolectar un tipo concreto.
    const ref = 1 + rng.int(types);
    const target = 12 + Math.min(60, d * 2);
    objectives.push({ kind: "collect", ref, target });
    stars = scoreStars(1800 + d * 470, d);
  } else {
    // Limpiar jelly en rombo creciente: target = nº de capas de jelly.
    const jellyCells = diamondCells(rows, cols, Math.min(4, 2 + Math.floor(d / 6)));
    objectives.push({ kind: "clear", ref: 0, target: jellyCells.length });
    stars = scoreStars(2000 + d * 560, d);
    const blockers: BlockerSpec[] = [{ kind: "jelly", cells: jellyCells }];
    // Cajas también en profundidad alta.
    if (d >= 8) {
      const count = Math.min(10, 2 + Math.floor(d / 4));
      blockers.push({ kind: "crate", cells: randomCells(rng, rows, cols, count, jellyCells) });
    }
    return finalize(id, d, rng, rows, cols, types, objectives, stars, blockers);
  }

  // Objetivo secundario a partir de cierta profundidad.
  let blockers: BlockerSpec[] = [];
  if (d >= 6 && rng.next() < 0.5) {
    const ref = 1 + rng.int(types);
    const target = 8 + Math.min(40, d + rng.int(d + 1));
    objectives.push({ kind: "collect", ref, target });
  }
  if (d >= 4) {
    const count = Math.min(12, Math.floor(d / 3) + rng.int(4));
    if (count > 0) {
      blockers = [{ kind: "crate", cells: randomCells(rng, rows, cols, count) }];
    }
  }
  return finalize(id, d, rng, rows, cols, types, objectives, stars, blockers);
}

/** Completea el nivel (nombre, seed, moves). */
function finalize(
  id: number,
  d: number,
  rng: Rng,
  rows: number,
  cols: number,
  types: number,
  objectives: Objective[],
  stars: [number, number, number],
  blockers: BlockerSpec[],
  ingredients?: { count: number; every: number },
): LevelDef {
  const moves = 20 + Math.min(12, Math.floor(d / 3)) + (blockers.length > 0 ? 2 : 0);
  const def: LevelDef = {
    id,
    name: NAMES[rng.int(NAMES.length)],
    seed: (id * 0x77777) | 0,
    rows,
    cols,
    types,
    moves,
    objectives,
    stars,
    blockers,
  };
  if (ingredients) def.ingredients = ingredients;
  return def;
}

/** Estrellas a partir del objetivo principal (por puntuación). */
function scoreStars(mainTarget: number, d: number): [number, number, number] {
  return [
    toN(mainTarget, 50),
    toN(mainTarget * 1.8 + d * 30, 50),
    toN(mainTarget * 2.6 + d * 60, 50),
  ];
}

function toN(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Rombo de jelly centrado, hasta `rings` de radio. */
function diamondCells(rows: number, cols: number, rings: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  const cr = Math.floor(rows / 2);
  const cc = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist = Math.abs(r - cr) + Math.abs(c - cc);
      if (dist <= rings) cells.push([r, c]);
    }
  }
  return cells;
}

/** Celdas random únicas (evitando las de jelly). */
function randomCells(rng: Rng, rows: number, cols: number, count: number, avoid: Array<[number, number]> = []): Array<[number, number]> {
  const skip = new Set(avoid.map(([r, c]) => r * cols + c));
  const out: Array<[number, number]> = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const r = rng.int(rows);
    const c = rng.int(cols);
    const key = r * cols + c;
    if (used.has(key) || skip.has(key)) continue;
    used.add(key);
    out.push([r, c]);
  }
  return out;
}
