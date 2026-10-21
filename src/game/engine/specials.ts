import type { SpecialKind } from "../levels";
import type { Board, BoardPosition } from "./board";
import type { Rng } from "./random";
import type { Run } from "./match";
import { runHas } from "./match";

/** Grupo con forma (run simple, cruce T/L o línea larga). */
export interface Shape {
  cells: BoardPosition[];
  type: number;
  /** Piezas especiales que nacen en este paso. */
  creations: Array<{ r: number; c: number; special: SpecialKind }>;
  isLine: boolean;
}

/** Indica qué especial nace de un run: 5 → bomba, 4 → rayada, cruce T/L → wrapped. */
function specialFor(run: Run, hint: BoardPosition | null, swapAxis: "h" | "v" | null): SpecialKind {
  if (run.cells.length >= 5) return "bomb";
  if (run.cells.length >= 4) {
    // Con hint, la dirección del intercambio decide; si no, la orientación del run.
    if (hint && swapAxis) return swapAxis === "h" ? "stripe-h" : "stripe-v";
    return run.horizontal ? "stripe-h" : "stripe-v";
  }
  return "none";
}

function pickCreationCell(run: Run, hint: BoardPosition | null): BoardPosition {
  if (hint && runHas(run, hint.r, hint.c)) return hint;
  return run.cells[Math.floor(run.cells.length / 2)];
}

/**
 * Convierte los runs en shapes: agrupa runs que se cruzan (T/L) en una sola
 * shape con wrapped, y determina qué especial nace y en qué celda.
 */
export function shapesFromRuns(runs: Run[], hint: BoardPosition | null, swapAxis: "h" | "v" | null): Shape[] {
  const sorted = runs.slice().sort((a, b) => b.cells.length - a.cells.length);
  const used = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const shapes: Shape[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const runA = sorted[i];
    if (runA.cells.every((p) => used.has(key(p.r, p.c)))) continue;

    let crossIdx = -1;
    let crossCell: BoardPosition | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const runB = sorted[j];
      if (runB.type !== runA.type) continue;
      if (runB.horizontal === runA.horizontal) continue;
      const shared = runB.cells.find((p) => runA.cells.some((q) => q.r === p.r && q.c === p.c));
      if (shared && !runB.cells.every((p) => used.has(key(p.r, p.c)))) {
        crossIdx = j;
        crossCell = shared;
        break;
      }
    }

    if (crossIdx >= 0 && crossCell) {
      const runB = sorted[crossIdx];
      const all = [...runA.cells, ...runB.cells].filter(
        (p, idx, arr) => arr.findIndex((q) => q.r === p.r && q.c === p.c) === idx,
      );
      let at = crossCell;
      if (hint && (runHas(runA, hint.r, hint.c) || runHas(runB, hint.r, hint.c))) at = hint;
      for (const p of all) used.add(key(p.r, p.c));
      shapes.push({
        cells: all,
        type: runA.type,
        isLine: false,
        creations: [{ r: at.r, c: at.c, special: "wrapped" }],
      });
    } else {
      const special = specialFor(runA, hint, swapAxis);
      for (const p of runA.cells) used.add(key(p.r, p.c));
      const creations = special === "none" ? [] : [{ ...pickCreationCell(runA, hint), special }];
      shapes.push({ cells: runA.cells.slice(), type: runA.type, isLine: true, creations });
    }
  }
  return shapes;
}

export interface Expansion {
  removal: Set<number>;
  triggers: Array<{ r: number; c: number; special: SpecialKind; type: number }>;
  /** Celdas de caja golpeadas (reciben daño, no se eliminan). */
  cratesHit: Set<number>;
}

/**
 * Expande los disparos de piezas especiales: rayada = fila/columna,
 * wrapped = 3×3, bomba = todo el color. Los ingredientes no se eliminan
 * y las cajas cerradas reciben daño en vez de eliminarse.
 */
export function expandRemovals(board: Board, seed: Set<number>, _rng: Rng): Expansion {
  const removal = new Set<number>(seed);
  const cratesHit = new Set<number>();
  const triggers: Expansion["triggers"] = [];
  const queue: Array<{ r: number; c: number; special: SpecialKind }> = [];
  const queued = new Set<number>();

  const enqueue = (r: number, c: number) => {
    const key = board.key(r, c);
    if (queued.has(key)) return;
    const cell = board.grid[r][c];
    if (!cell) return;
    queued.add(key);
    if (cell.inCrate) {
      cratesHit.add(key);
      return;
    }
    if (cell.ingredient) return;
    removal.add(key);
    if (cell.special !== "none") queue.push({ r, c, special: cell.special });
  };

  for (const key of seed) {
    const r = Math.floor(key / board.cols);
    const c = key % board.cols;
    enqueue(r, c);
  }

  while (queue.length > 0) {
    const item = queue.shift()!;
    const cell = board.grid[item.r][item.c];
    if (!cell) continue;
    triggers.push({ r: item.r, c: item.c, special: item.special, type: cell.type });
    if (item.special === "stripe-h") {
      for (let c = 0; c < board.cols; c++) enqueue(item.r, c);
    } else if (item.special === "stripe-v") {
      for (let r = 0; r < board.rows; r++) enqueue(r, item.c);
    } else if (item.special === "wrapped") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = item.r + dr;
          const c = item.c + dc;
          if (board.inBounds(r, c)) enqueue(r, c);
        }
      }
    } else if (item.special === "bomb") {
      const bombType = cell.type;
      board.each((other, r, c) => {
        if (!other.ingredient && other.type === bombType) enqueue(r, c);
      });
    }
  }

  return { removal, triggers, cratesHit };
}

/** Plan de disparo cuando se intercambian dos piezas especiales (o bomba + normal). */
export function comboPlan(
  board: Board,
  a: BoardPosition,
  b: BoardPosition,
  specA: SpecialKind,
  specB: SpecialKind,
): Set<number> | null {
  const key = (p: BoardPosition) => board.key(p.r, p.c);
  const seeds = new Set<number>();

  const isStripe = (s: SpecialKind) => s === "stripe-h" || s === "stripe-v";

  // Bomba + pieza normal: limpia todo el color de la pieza normal.
  if (specA === "bomb" && specB === "none") {
    const t = board.grid[b.r][b.c]?.type ?? 0;
    if (t > 0) {
      board.each((cell, r, c) => {
        if (!cell.ingredient && cell.type === t) seeds.add(board.key(r, c));
      });
    }
    seeds.add(key(a));
    return seeds;
  }
  if (specB === "bomb" && specA === "none") {
    const t = board.grid[a.r][a.c]?.type ?? 0;
    if (t > 0) {
      board.each((cell, r, c) => {
        if (!cell.ingredient && cell.type === t) seeds.add(board.key(r, c));
      });
    }
    seeds.add(key(b));
    return seeds;
  }

  if (specA === "none" || specB === "none") return null;

  // Bomba + bomba: borra el tablero entero.
  if (specA === "bomb" && specB === "bomb") {
    board.each((_cell, r, c) => seeds.add(board.key(r, c)));
    return seeds;
  }

  // Bomba + rayada/wrapped: limpia el color de la especial (además del disparo propio).
  if (specA === "bomb" || specB === "bomb") {
    const bombPos = specA === "bomb" ? a : b;
    const otherPos = specA === "bomb" ? b : a;
    const t = board.grid[otherPos.r][otherPos.c]?.type ?? 0;
    if (t > 0) {
      board.each((cell, r, c) => {
        if (!cell.ingredient && cell.type === t) seeds.add(board.key(r, c));
      });
    }
    seeds.add(key(bombPos));
    seeds.add(key(otherPos));
    return seeds;
  }

  // Rayada + rayada: par de líneas.
  if (isStripe(specA) && isStripe(specB)) {
    const lines: Array<{ r: number; c: number; kind: "row" | "col" }> = [];
    lines.push({ r: a.r, c: a.c, kind: specA === "stripe-h" ? "row" : "col" });
    lines.push({ r: b.r, c: b.c, kind: specB === "stripe-h" ? "row" : "col" });
    for (const line of lines) {
      if (line.kind === "row") for (let c = 0; c < board.cols; c++) seeds.add(board.key(line.r, c));
      else for (let r = 0; r < board.rows; r++) seeds.add(board.key(r, line.c));
    }
    return seeds;
  }

  // Rayada + wrapped: tres filas/columnas y tres perpendiculares.
  if ((isStripe(specA) && specB === "wrapped") || (isStripe(specB) && specA === "wrapped")) {
    const stripePos = isStripe(specA) ? a : b;
    const stripeSpec = isStripe(specA) ? specA : specB;
    const wrappedPos = specA === "wrapped" ? a : b;
    const target = stripePos;
    for (let d = -1; d <= 1; d++) {
      if (stripeSpec === "stripe-h") {
        const rr = target.r + d;
        if (board.inBounds(rr, 0)) for (let c = 0; c < board.cols; c++) seeds.add(board.key(rr, c));
      } else {
        const cc = target.c + d;
        if (board.inBounds(0, cc)) for (let r = 0; r < board.rows; r++) seeds.add(board.key(r, cc));
      }
    }
    // El wrapped también estalla, centrado en su propia celda.
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = wrappedPos.r + dr;
        const c = wrappedPos.c + dc;
        if (board.inBounds(r, c)) seeds.add(board.key(r, c));
      }
    }
    return seeds;
  }

  // Wrapped + wrapped: explosión 5×5.
  if (specA === "wrapped" && specB === "wrapped") {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = a.r + dr;
        const c = a.c + dc;
        if (board.inBounds(r, c)) seeds.add(board.key(r, c));
      }
    }
    return seeds;
  }

  return seeds.size > 0 ? seeds : null;
}
