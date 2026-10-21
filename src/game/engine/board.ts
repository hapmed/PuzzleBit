import type { BlockerKind, LevelDef, SpecialKind } from "../levels";
import { findMatches } from "./match";
import { Rng, deriveSeed } from "./random";

export interface Cell {
  /** Identificador estable dentro de la partida, para animaciones. */
  id: number;
  /** 1..level.types (0 = ingrediente: no combina, solo cae). */
  type: number;
  special: SpecialKind;
  /** Ingrediente (transportable al fondo). */
  ingredient: boolean;
  /** Encerrado por caja: no se mueve, no combina; se libera destruyendo la caja. */
  inCrate: boolean;
}

export type CellGrid = Array<Array<Cell | null>>;

export interface ObjectiveState {
  kind: string;
  ref?: number;
  target: number;
  progress: number;
}

export interface BlockerCell {
  kind: BlockerKind;
  hp: number;
}

export interface BoardPosition {
  r: number;
  c: number;
}

/** Tablero del motor: rejilla + bloqueadores + objetivos. Puro TypeScript. */
export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly types: number;
  readonly seed: number;

  grid: CellGrid = [];
  /** Bloqueadores fijos (caja/jelly). key = r*C+c */
  barriers = new Map<number, BlockerCell>();
  jelly = new Map<number, number>();

  counts = new Map<number, number>(); // piezas eliminadas por tipo (para objetivos "collect")
  ingredientsCollected = 0;
  ingredientsQuota = 0;
  nextIngredientIn = 0; // tiradas restantes del dispensador
  ingredientEvery = 0; // frecuencia de uso

  private idSeq = 0;

  constructor(level: LevelDef) {
    this.rows = level.rows;
    this.cols = level.cols;
    this.types = level.types;
    this.seed = level.seed;
  }

  makePiece(type: number, special: SpecialKind = "none"): Cell {
    return {
      id: ++this.idSeq,
      type,
      special,
      ingredient: false,
      inCrate: false,
    };
  }

  makeIngredient(): Cell {
    return {
      id: ++this.idSeq,
      type: 0,
      special: "none",
      ingredient: true,
      inCrate: false,
    };
  }

  get(r: number, c: number): Cell | null {
    return this.grid[r][c];
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols;
  }

  /** Celda con bloqueador fijo indestructible a la vez (caja cerrada). */
  isLocked(r: number, c: number): boolean {
    const b = this.barriers.get(r * this.cols + c);
    return !!b && b.kind === "crate" && b.hp > 0;
  }

  isMovable(r: number, c: number): boolean {
    const cell = this.grid[r][c];
    return !!cell && !cell.inCrate && !cell.ingredient;
  }

  key(r: number, c: number): number {
    return r * this.cols + c;
  }

  /** La partida puede terminarse por objetivos ya cumplidos. */
  allObjectivesDone(objectives: ObjectiveState[]): boolean {
    return objectives.every((o) => o.progress >= o.target);
  }

  /** Barre el tablero llamando a fn por cada pieza presente. */
  each(fn: (cell: Cell, r: number, c: number) => void): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell) fn(cell, r, c);
      }
    }
  }

  clone(): Board {
    const clone = Object.create(Board.prototype) as Board;
    (clone as unknown as { idSeq: number }).idSeq = this.idSeq;
    clone.grid = this.grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    clone.barriers = new Map(Array.from(this.barriers.entries(), ([k, v]) => [k, { ...v }]));
    clone.jelly = new Map(this.jelly);
    clone.counts = new Map(this.counts);
    clone.ingredientsCollected = this.ingredientsCollected;
    clone.ingredientsQuota = this.ingredientsQuota;
    clone.nextIngredientIn = this.nextIngredientIn;
    clone.ingredientEvery = this.ingredientEvery;
    return clone;
  }

  /**
   * Genera el tablero inicial sin matches y con movimientos posibles.
   * Determinista para la misma semilla.
   */
  static createFromLevel(level: LevelDef): Board {
    const rng = new Rng(deriveSeed(level.seed, 1));
    let board = Board.build(level, rng);
    let tryIdx = 0;
    while (possibleMoves(board).length === 0 && tryIdx < 20) {
      tryIdx++;
      board = Board.build(level, new Rng(deriveSeed(level.seed, 1 + tryIdx)));
    }
    // Último recurso: barajar los colores de las piezas (puede repetirse hasta
    // lograr un tablero jugable; es determinista con la misma semilla).
    if (possibleMoves(board).length === 0) shufflePieces(board, new Rng(deriveSeed(level.seed, 999)));
    return board;
  }

  private static build(level: LevelDef, rng: Rng): Board {
    const board = new Board(level);

    // Bloqueadores: cajas en barriers, capas de jelly en jelly.
    for (const spec of level.blockers) {
      for (const [r, c] of spec.cells) {
        if (spec.kind === "crate") {
          board.barriers.set(board.key(r, c), { kind: "crate", hp: 2 });
        } else {
          board.jelly.set(board.key(r, c), 1);
        }
      }
    }

    // Relleno sin matches: elegir color distinto al de las dos previas arriba/izquierda.
    board.grid = [];
    for (let r = 0; r < level.rows; r++) {
      const row: Array<Cell | null> = [];
      for (let c = 0; c < level.cols; c++) {
        const banned = new Set<number>();
        if (c >= 2 && row[c - 1]?.type === row[c - 2]?.type && !row[c - 1]?.ingredient && !row[c - 2]?.ingredient) {
          const t = row[c - 1]
            ? row[c - 1]!.type
            : 0;
          if (t) banned.add(t);
        }
        if (r >= 2) {
          const a = board.grid[r - 1][c];
          const b = board.grid[r - 2][c];
          if (a && b && a.type === b.type && !a.ingredient && !b.ingredient && a.type) banned.add(a.type);
        }
        // Prohibir también completar un cuadro 2×2 con las tres celdas que
        // cierran la esquina (arriba, izquierda y diagonal).
        if (r >= 1 && c >= 1) {
          const up = board.grid[r - 1][c];
          const left = row[c - 1];
          const diag = board.grid[r - 1][c - 1];
          if (
            up && left && diag &&
            up.type === left.type && left.type === diag.type &&
            !up.ingredient && !left.ingredient && !diag.ingredient &&
            up.type > 0
          ) {
            banned.add(up.type);
          }
        }
        const pairs: number[] = [];
        for (let t = 1; t <= level.types; t++) if (!banned.has(t)) pairs.push(t);
        const type = pairs.length ? rng.pick(pairs) : 1 + rng.int(level.types);
        const cell = board.makePiece(type);
        if (board.isLocked(r, c)) cell.inCrate = true;
        row.push(cell);
      }
      board.grid.push(row);
    }

    // Ingredientes: convertir algunas piezas normales en ingredientes separados,
    // evitando filas/columnas adyacentes para que no bloqueen el arranque.
    if (level.ingredients && level.ingredients.count > 0) {
      board.ingredientsQuota = level.ingredients.count;
      board.ingredientEvery = level.ingredients.every;
      board.nextIngredientIn = 0;
    }
    return board;
  }
}

/** Lista movimientos válidos (swap que produce match o uso de especial). */
export function possibleMoves(board: Board): Array<[BoardPosition, BoardPosition]> {
  const moves: Array<[BoardPosition, BoardPosition]> = [];
  const test = (r1: number, c1: number, r2: number, c2: number) => {
    if (!board.isMovable(r1, c1) || !board.isMovable(r2, c2)) return;
    const a = board.grid[r1][c1]!;
    const b = board.grid[r2][c2]!;
    if (a.special !== "none" || b.special !== "none") {
      moves.push([{ r: r1, c: c1 }, { r: r2, c: c2 }]);
      return;
    }
    // swap temporal
    board.grid[r1][c1] = b;
    board.grid[r2][c2] = a;
    const ok = findMatches(board).length > 0;
    board.grid[r1][c1] = a;
    board.grid[r2][c2] = b;
    if (ok) moves.push([{ r: r1, c: c1 }, { r: r2, c: c2 }]);
  };
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (c + 1 < board.cols) test(r, c, r, c + 1);
      if (r + 1 < board.rows) test(r, c, r + 1, c);
    }
  }
  return moves;
}

/**
 * Baraja los colores de todas las piezas movibles hasta que el tablero
 * quede sin matches e incluya al menos un movimiento.
 */
export function shufflePieces(board: Board, rng: Rng): boolean {
  const movable: Array<{ r: number; c: number; type: number; special: SpecialKind }> = [];
  board.each((cell, r, c) => {
    if (cell.inCrate || cell.ingredient) return;
    movable.push({ r, c, type: cell.type, special: cell.special });
  });

  for (let attempt = 0; attempt < 30; attempt++) {
    const values = rng.shuffle(movable.map((m) => ({ type: m.type, special: m.special })));
    for (let i = 0; i < movable.length; i++) {
      const cell = board.grid[movable[i].r][movable[i].c]!;
      cell.type = values[i].type;
      cell.special = values[i].special;
    }
    if (findMatches(board).length === 0 && possibleMoves(board).length > 0) return true;
  }
  return false;
}
