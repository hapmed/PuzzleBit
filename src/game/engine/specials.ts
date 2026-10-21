import type { SpecialKind } from "../levels";
import type { Board, BoardPosition } from "./board";
import type { Rng } from "./random";
import type { Run } from "./match";

/** Grupo con forma (línea, cruce T/L, cuadro 2×2 o combinaciones pegadas). */
export interface Shape {
  cells: BoardPosition[];
  type: number;
  /** Piezas especiales que nacen en este paso. */
  creations: Array<{ r: number; c: number; special: SpecialKind }>;
  isLine: boolean;
}

interface ShapeNode {
  cells: Map<string, BoardPosition>;
  type: number;
  /** La shape contiene runs horizontales/verticales o cuadros. */
  horizontal: boolean;
  vertical: boolean;
  /** Longitud de la línea más larga dentro de la shape. */
  maxLine: number;
  hasSquare: boolean;
  /** Celda compartida cuando dos runs/cuadros se fusionan (cruce). */
  crossAt: BoardPosition | null;
}

function newNodeFromRun(run: Run): ShapeNode {
  const node: ShapeNode = {
    cells: new Map(),
    type: run.type,
    horizontal: false,
    vertical: false,
    maxLine: 0,
    hasSquare: false,
    crossAt: null,
  };
  if (run.square) {
    node.hasSquare = true;
  } else {
    if (run.horizontal) node.horizontal = true;
    else node.vertical = true;
    node.maxLine = run.cells.length;
  }
  for (const p of run.cells) node.cells.set(`${p.r},${p.c}`, p);
  return node;
}

/**
 * Regla de especial nacido de una shape final:
 * - shape de 6+ celdas (cuadros pegados, cuadro+línea) o línea de 5 → bomba.
 * - cruce T/L de líneas o cuadro (puro o pegado) → wrapped.
 * - línea de 4 → rayada (orientación del swap si hay pista).
 * - línea de 3 → nada.
 */
function decideSpecial(node: ShapeNode, hint: BoardPosition | null, swapAxis: "h" | "v" | null): SpecialKind {
  if (node.cells.size >= 6 || node.maxLine >= 5) return "bomb";
  if (node.horizontal && node.vertical) return "wrapped";
  if (node.hasSquare) return "wrapped";
  if (node.maxLine === 4) {
    if (hint && swapAxis && node.cells.has(`${hint.r},${hint.c}`)) {
      return swapAxis === "h" ? "stripe-h" : "stripe-v";
    }
    return node.horizontal ? "stripe-h" : "stripe-v";
  }
  return "none";
}

/**
 * Convierte los grupos rompibles en shapes: fusiona cuadros 2×2 con líneas
 * y cruces que compartan celdas (conectados), y decide qué especial nace
 * y en qué celda (celda del swap si toca la shape, sino el punto de cruce,
 * sino la celda central).
 */
export function shapesFromRuns(runs: Run[], hint: BoardPosition | null, swapAxis: "h" | "v" | null): Shape[] {
  const nodes = runs.map(newNodeFromRun);

  // Union-find por compartición de celdas (número de grupos pequeño; el bucle
  // O(n²) por pasada es suficiente y determinista).
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (a.type !== b.type) continue;
        let shared: BoardPosition | null = null;
        for (const [k, p] of a.cells) {
          if (b.cells.has(k)) {
            shared = p;
            break;
          }
        }
        if (!shared) continue;
        // Fuusiona b dentro de a y queda registrada la celda compartida.
        for (const [k, p] of b.cells) a.cells.set(k, p);
        a.horizontal = a.horizontal || b.horizontal;
        a.vertical = a.vertical || b.vertical;
        a.maxLine = Math.max(a.maxLine, b.maxLine);
        a.hasSquare = a.hasSquare || b.hasSquare;
        if (a.crossAt === null) a.crossAt = shared;
        nodes.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  return nodes.map((node) => {
    const cells = [...node.cells.values()].sort((p, q) => p.r - q.r || p.c - q.c);
    const special = decideSpecial(node, hint, swapAxis);
    let at: BoardPosition | null = null;
    if (special !== "none") {
      at = hint && node.cells.has(`${hint.r},${hint.c}`) ? hint : (node.crossAt ?? cells[Math.floor(cells.length / 2)]);
    }
    const singleDir = !node.hasSquare && !(node.horizontal && node.vertical);
    return {
      cells,
      type: node.type,
      isLine: singleDir,
      creations: special === "none" || at === null ? [] : [{ r: at.r, c: at.c, special }],
    };
  });
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
