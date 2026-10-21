import type { LevelDef, SpecialKind } from "../levels";
import { Board, type BoardPosition } from "./board";
import { possibleMoves, shufflePieces } from "./board";
import { applyGravity, type FallEvent, type SpawnEvent } from "./cascade";
import { findMatches } from "./match";
import { shapesFromRuns } from "./specials";
import { Rng, deriveSeed } from "./random";
import { comboPlan, expandRemovals } from "./specials";
import {
  INGREDIENT_BONUS,
  JELLY_BONUS,
  SPECIAL_CREATION_BONUS,
  SPECIAL_TRIGGER_BONUS,
  blockPoints,
} from "./score";

export interface ObjectiveState {
  kind: string;
  ref?: number;
  target: number;
  progress: number;
}

export interface RemovedCellInfo {
  r: number;
  c: number;
  id: number;
  type: number;
  special: SpecialKind;
  ingredient: boolean;
}

export interface CreatedInfo {
  id: number;
  r: number;
  c: number;
  type: number;
  special: SpecialKind;
}

export type GameEvent =
  | { kind: "swap"; aId: number; bId: number; from: BoardPosition; to: BoardPosition }
  | { kind: "revert"; aId: number; bId: number; posA: BoardPosition; posB: BoardPosition }
  | {
      kind: "remove";
      cells: RemovedCellInfo[];
      created: CreatedInfo[];
      triggers: Array<{ r: number; c: number; special: SpecialKind }>;
      revealed: Array<{ r: number; c: number; id: number }>;
      jelly: number[];
      score: number;
    }
  | { kind: "fall"; falls: FallEvent[] }
  | { kind: "spawn"; spawns: SpawnEvent[] }
  | { kind: "ingredient"; collected: Array<{ r: number; c: number; id: number }> }
  | { kind: "reshuffle" };

export interface TurnResult {
  ok: boolean;
  events: GameEvent[];
  won: boolean;
  lost: boolean;
}

export class Engine {
  readonly level: LevelDef;
  board: Board;
  score = 0;
  movesLeft: number;
  objectives: ObjectiveState[] = [];
  finished = false;
  won = false;
  private rng: Rng;
  private initialJelly = 0;
  private shufflesUsed = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.board = Board.createFromLevel(level);
    this.movesLeft = level.moves;
    this.rng = new Rng(deriveSeed(level.seed, 2));
    this.objectives = level.objectives.map((o) => ({ kind: o.kind, ref: o.ref, target: o.target, progress: 0 }));
    for (const hp of this.board.jelly.values()) this.initialJelly += hp;
    this.recomputeObjectives();
    this.evaluateEnd();
  }

  key(r: number, c: number): number {
    return this.board.key(r, c);
  }

  /** Número de capas de jelly restantes. */
  jellyCount(): number {
    let n = 0;
    for (const hp of this.board.jelly.values()) n += hp;
    return n;
  }

  /** Progreso de objetivos a partir del estado del tablero. */
  private recomputeObjectives(): void {
    for (const obj of this.objectives) {
      switch (obj.kind) {
        case "score":
          obj.progress = this.score;
          break;
        case "collect":
          obj.progress = this.board.counts.get(obj.ref ?? 0) ?? 0;
          break;
        case "clear": {
          let jellyLeft = 0;
          for (const hp of this.board.jelly.values()) jellyLeft += hp;
          obj.progress = this.initialJelly - jellyLeft;
          break;
        }
        case "ingredient":
          obj.progress = this.board.ingredientsCollected;
          break;
      }
    }
  }

  private objectivesMet(): boolean {
    return this.objectives.every((o) => o.progress >= o.target);
  }

  private evaluateEnd(): { won: boolean; lost: boolean } {
    if (this.finished) return { won: this.won, lost: !this.won };
    const wonByObjectives = this.objectivesMet();
    if (wonByObjectives) {
      this.finished = true;
      this.won = true;
      return { won: true, lost: false };
    }
    if (this.movesLeft <= 0) {
      this.finished = true;
      this.won = false;
      return { won: false, lost: true };
    }
    return { won: false, lost: false };
  }

  /** Turno del jugador: intercambio de dos piezas adyacentes. */
  attemptSwap(a: BoardPosition, b: BoardPosition): TurnResult {
    const events: GameEvent[] = [];
    const board = this.board;
    if (this.finished) return { ok: false, events, won: this.won, lost: !this.won };
    if (!board.inBounds(a.r, a.c) || !board.inBounds(b.r, b.c)) {
      return { ok: false, events, won: false, lost: false };
    }
    const adjacent = Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
    if (!adjacent || !board.isMovable(a.r, a.c) || !board.isMovable(b.r, b.c)) {
      return { ok: false, events, won: false, lost: false };
    }

    const pa = board.grid[a.r][a.c]!;
    const pb = board.grid[b.r][b.c]!;

    // 1. Aplica el intercambio.
    board.grid[a.r][a.c] = pb;
    board.grid[b.r][b.c] = pa;
    events.push({ kind: "swap", aId: pb.id, bId: pa.id, from: a, to: b });

    const specA = pb.special; // pieza ahora en a (venía de b)
    const specB = pa.special; // pieza ahora en b (venía de a)

    // 2. Combo de dos especiales, o bomba + pieza normal.
    const comboSeeds = comboPlan(board, a, b, specA, specB);

    let swapAxis: "h" | "v" | null = null;
    let hintPos: BoardPosition | null = null;
    if (!comboSeeds) {
      // Swap normal: debe producir matches o se revierte.
      const runs = findMatches(board);
      if (runs.length === 0) {
        board.grid[a.r][a.c] = pa;
        board.grid[b.r][b.c] = pb;
        events.push({ kind: "revert", aId: pa.id, bId: pb.id, posA: a, posB: b });
        return { ok: false, events, won: this.won, lost: !this.won };
      }
      swapAxis = a.r === b.r ? "h" : "v";
      hintPos = b;
    }

    // Consumimos un movimiento con cualquier cambio válido (combo o match).
    this.movesLeft--;

    if (comboSeeds) {
      // Bucle de resolución con las semillas del combo como primer paso.
      let step = 0;
      let seeds: Set<number> | null = new Set(comboSeeds);
      while (seeds !== null) {
        seeds = this.resolveStep(seeds, step, events);
        step++;
      }
    } else {
      // Bucle de resolución normal partiendo del match del swap.
      let step = 0;
      while (true) {
        const runs = findMatches(board);
        if (runs.length === 0) break;
        const shapes = shapesFromRuns(runs, step === 0 ? hintPos : null, step === 0 ? swapAxis : null);
        const seedSet = new Set<number>();
        for (const shape of shapes) {
          for (const p of shape.cells) seedSet.add(this.key(p.r, p.c));
          for (const cr of shape.creations) seedSet.delete(this.key(cr.r, cr.c));
        }
        this.resolveStep(seedSet, step, events, shapes.map((sh) => sh.creations).flat());
        hintPos = null;
        step++;
      }
    }

    // 4. Ingredientes que llegan al fondo, relleno y reevaluación.
    this.applyIngredientArrivals(events);

    // 5. Tablero sin movimientos → reshuffle.
    if (!this.finished && possibleMoves(board).length === 0) this.doReshuffle(events);

    const end = this.evaluateEnd();
    this.recomputeObjectives();
    return { ok: true, events, won: end.won, lost: end.lost };
  }

  /**
   * Ejecuta un paso de resolución: elimina semillas + expansión de especiales,
   * aplica daño a cajas, puntúa y devuelve nuevas semillas tras la caída
   * (incluidas celdas reveladas de cajas).
   */
  private resolveStep(
    seeds: Set<number>,
    step: number,
    events: GameEvent[],
    creationsHint?: Array<{ r: number; c: number; special: SpecialKind }>,
  ): Set<number> | null {
    const board = this.board;
    // La expansión puede encadenar especiales dentro de las semillas.
    const expansion = expandRemovals(board, seeds, this.rng);
    const removal = new Set<number>(expansion.removal);
    // Evita que los triggers destruyan piezas especiales recién creadas:
    // las celdas del hint mueren antes de la expansión.
    for (const cr of creationsHint ?? []) removal.delete(this.key(cr.r, cr.c));

    const removedCells: RemovedCellInfo[] = [];
    let jellyKeys: number[] = [];
    for (const key of removal) {
      const r = Math.floor(key / board.cols);
      const c = key % board.cols;
      const cell = board.grid[r][c];
      if (!cell || cell.inCrate || cell.ingredient) continue;
      removedCells.push({ r, c, id: cell.id, type: cell.type, special: cell.special, ingredient: false });
      board.grid[r][c] = null;
      if (cell.type > 0) board.counts.set(cell.type, (board.counts.get(cell.type) ?? 0) + 1);
    }
    for (const key of removal) {
      const j = board.jelly.get(key);
      if (j !== undefined) {
        jellyKeys.push(key);
        if (j <= 1) board.jelly.delete(key);
        else board.jelly.set(key, j - 1);
      }
    }

    const created: CreatedInfo[] = [];
    for (const cr of creationsHint ?? []) {
      const cell = board.grid[cr.r][cr.c];
      if (!cell || cell.inCrate || cell.ingredient) continue;
      cell.special = cr.special;
      created.push({ id: cell.id, r: cr.r, c: cr.c, type: cell.type, special: cr.special });
    }

    for (const key of expansion.cratesHit) {
      const barrier = board.barriers.get(key);
      if (!barrier) continue;
      barrier.hp--;
      if (barrier.hp <= 0) {
        board.barriers.delete(key);
        const r = Math.floor(key / board.cols);
        const c = key % board.cols;
        const cell = board.grid[r][c];
        if (cell) cell.inCrate = false;
      }
    }
    const revealed: Array<{ r: number; c: number; id: number }> = [];
    for (const key of expansion.cratesHit) {
      if (!board.barriers.has(key)) {
        const r = Math.floor(key / board.cols);
        const c = key % board.cols;
        const cell = board.grid[r][c];
        if (cell) revealed.push({ r, c, id: cell.id });
      }
    }

    const jellyBonus = jellyKeys.length * JELLY_BONUS;
    this.score +=
      blockPoints(removedCells.length, step) +
      created.length * SPECIAL_CREATION_BONUS +
      expansion.triggers.length * SPECIAL_TRIGGER_BONUS +
      jellyBonus;
    this.recomputeObjectives();

    events.push({
      kind: "remove",
      cells: removedCells,
      created,
      triggers: expansion.triggers.map((t) => ({ r: t.r, c: t.c, special: t.special })),
      revealed,
      jelly: jellyKeys,
      score: this.score,
    });

    // Caída + relleno.
    const grav = applyGravity(board, this.rng);
    if (grav.falls.length) events.push({ kind: "fall", falls: grav.falls });
    if (grav.spawns.length) events.push({ kind: "spawn", spawns: grav.spawns });

    // Piezas reveladas de cajas pueden crear matches propios → otra ronda.
    const nextRuns = findMatches(board);
    if (nextRuns.length > 0) {
      const nextSeed = new Set<number>();
      for (const run of nextRuns) for (const p of run.cells) nextSeed.add(this.key(p.r, p.c));
      return nextSeed;
    }
    return null;
  }

  /** Recoge ingredientes que alcanzan la fila inferior y repone el hueco. */
  private applyIngredientArrivals(events: GameEvent[]): void {
    const board = this.board;
    for (;;) {
      const collected: Array<{ r: number; c: number; id: number }> = [];
      for (let c = 0; c < board.cols; c++) {
        const cell = board.grid[board.rows - 1][c];
        if (cell?.ingredient) {
          collected.push({ r: board.rows - 1, c, id: cell.id });
          board.grid[board.rows - 1][c] = null;
          board.ingredientsCollected++;
          this.score += INGREDIENT_BONUS;
        }
      }
      if (collected.length === 0) break;
      events.push({ kind: "ingredient", collected });
      const grav = applyGravity(board, this.rng);
      if (grav.falls.length) events.push({ kind: "fall", falls: grav.falls });
      if (grav.spawns.length) events.push({ kind: "spawn", spawns: grav.spawns });
      this.recomputeObjectives();
    }
  }

  private doReshuffle(events: GameEvent[]): void {
    const board = this.board;
    for (let i = 0; i < 60; i++) {
      const rng = i === 0 ? this.rng : new Rng(deriveSeed(this.level.seed, 100 + this.shufflesUsed * 8 + i));
      if (shufflePieces(board, rng)) break;
    }
    this.shufflesUsed++;
    events.push({ kind: "reshuffle" });
  }

  /** Booster: martillo sobre una celda (no consume movimiento). */
  useHammer(pos: BoardPosition): TurnResult {
    const events: GameEvent[] = [];
    const board = this.board;
    if (this.finished) return { ok: false, events, won: this.won, lost: !this.won };
    if (!board.inBounds(pos.r, pos.c) || !board.isMovable(pos.r, pos.c)) {
      return { ok: false, events, won: false, lost: false };
    }
    const seeds = new Set<number>([this.key(pos.r, pos.c)]);
    let step = 0;
    let next: Set<number> | null = seeds;
    while (next !== null) {
      next = this.resolveStep(next, step, events);
      step++;
    }
    this.applyIngredientArrivals(events);
    if (!this.finished && possibleMoves(board).length === 0) this.doReshuffle(events);
    const end = this.evaluateEnd();
    this.recomputeObjectives();
    return { ok: true, events, won: end.won, lost: end.lost };
  }

  /** Booster: mezclar el tablero ahora mismo. */
  useShuffle(): TurnResult {
    const events: GameEvent[] = [];
    this.doReshuffle(events);
    const end = this.evaluateEnd();
    return { ok: true, events, won: end.won, lost: end.lost };
  }

  /** Booster: movimiento extra. */
  addMove(): void {
    if (!this.finished) this.movesLeft++;
  }
}
