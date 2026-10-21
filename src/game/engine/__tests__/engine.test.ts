import { describe, expect, it } from "vitest";

import { findMatches, runHas } from "../match";
import { Board, possibleMoves, shufflePieces } from "../board";
import { Rng } from "../random";
import { Engine } from "../engine";
import { cascadeMultiplier, starsForScore } from "../score";
import { expandRemovals, shapesFromRuns } from "../specials";
import type { LevelDef } from "../../levels";

const baseLevel: LevelDef = {
  id: 1,
  name: "test",
  seed: 101,
  rows: 8,
  cols: 8,
  types: 5,
  moves: 20,
  objectives: [{ kind: "score", target: 1000 }],
  stars: [1000, 1800, 2600],
  blockers: [],
};

function simpleLevel(rows: number, cols: number, types = 5): LevelDef {
  return { ...baseLevel, rows, cols, types };
}

describe("random aleatorio (PRNG)", () => {
  it("genera secuencias reproducibles", () => {
    const a = new Rng(101);
    const b = new Rng(101);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() se mantiene en rango", () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });
});

describe("tablero inicial", () => {
  it("no tiene matches y tiene movimientos", () => {
    const board = Board.createFromLevel(baseLevel);
    expect(findMatches(board)).toHaveLength(0);
    expect(possibleMoves(board).length).toBeGreaterThan(0);
  });

  it("es determinista con la misma semilla", () => {
    const a = Board.createFromLevel(baseLevel);
    const b = Board.createFromLevel(baseLevel);
    expect(boardKey(a)).toBe(boardKey(b));
  });

  it("respeta el punto prohibido de trios (sin matches)", () => {
    for (const seed of [1, 7, 42, 999]) {
      board_tmp(seed);
    }
    function board_tmp(seed: number) {
      const l = { ...baseLevel, seed };
      const b = Board.createFromLevel(l);
      expect(findMatches(b)).toHaveLength(0);
    }
  });

  it("crea cajas/jelly según bloqueadores", () => {
    const l: LevelDef = {
      ...baseLevel,
      blockers: [
        { kind: "crate", cells: [[0, 0]] },
        { kind: "jelly", cells: [[1, 1], [2, 2]] },
      ],
    };
    const b = Board.createFromLevel(l);
    expect(b.barriers.get(b.key(0, 0))).toBeDefined();
    expect(b.isLocked(0, 0)).toBe(true);
    expect(b.jelly.get(b.key(1, 1))).toBe(1);
    expect(b.jelly.get(b.key(2, 2))).toBe(1);
  });
});

describe("matches", () => {
  it("detecta líneas horizontales y verticales", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    // Fuerzamos una línea sencilla de 3 horizontales (piezas de tipo 1).
    const rng = new Rng(5);
    const layout = [
      [1, 1, 1, 2, 3],
      [2, 3, 2, 1, 3],
      [1, 2, 3, 1, 2],
      [1, 3, 1, 2, 1],
      [2, 1, 3, 1, 2],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const t = layout[r][c];
        const cell = board.makePiece(t);
        board.grid[r][c] = cell;
      }
    }
    void rng;
    const matches = findMatches(board);
    expect(matches).toHaveLength(1);
    expect(matches[0].horizontal).toBe(true);
    expect(matches[0].cells.length).toBe(3);
    expect(runHas(matches[0], 0, 0)).toBe(true);
  });

  it("no mezcla ingredientes ni cajas en matches", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    const layout = [
      [0, 1, 1, 1, 3],
      [2, 3, 2, 1, 3],
      [1, 2, 3, 1, 2],
      [1, 3, 1, 2, 1],
      [2, 1, 3, 1, 2],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const t = layout[r][c];
        const cell = t === 0 ? board.makeIngredient() : board.makePiece(t);
        board.grid[r][c] = cell;
      }
    }
    const matches = findMatches(board);
    // Hay match de tipo 1 en la fila superior, pero nunca incluye el ingrediente.
    const topRun = matches.find((m) => m.horizontal && m.type === 1 && m.cells[0].r === 0);
    expect(topRun).toBeDefined();
    expect(topRun!.cells.some((p) => p.c === 0)).toBe(false);
    expect(topRun!.cells.length).toBe(3);
  });
});

describe("turnos del engine", () => {
  function forcedNearMatches(): Engine {
    const engine = new Engine(simpleLevel(5, 5, 3));
    const board = engine.board;
    const layout = [
      [1, 2, 3, 1, 2],
      [2, 1, 2, 3, 1],
      [3, 2, 1, 2, 3],
      [1, 3, 2, 3, 1],
      [2, 3, 1, 1, 2],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const t = layout[r][c];
        const cell = board.makePiece(t);
        board.grid[r][c] = cell;
      }
    }
    return engine;
  }

  it("un swap invalid se revierte y no consume movimiento", () => {
    const engine = forcedNearMatches();
    const moves0 = engine.movesLeft;
    const score0 = engine.score;
    // (0,0) tipo 1, (0,1) tipo 2: 1-2 reversible no genera match (ninguna linea).
    let result = engine.attemptSwap({ r: 0, c: 0 }, { r: 0, c: 1 });
    expect(result.ok).toBe(false);
    expect(engine.movesLeft).toBe(moves0);
    expect(engine.score).toBe(score0);
    // Revert vuelve al estado inicial.
    let events = result.events;
    expect(events.some((e) => e.kind === "revert")).toBe(true);
    expect(boardKeyOfEngine(engine)).toBe("1,2,3,1,2|2,1,2,3,1|3,2,1,2,3|1,3,2,3,1|2,3,1,1,2");
    void events;
    void result;
  });

  it("un swap válido genera match y consume un movimiento", () => {
    const engine = forcedNearMatches();
    const moves0 = engine.movesLeft;
    // (2,1)=2 intercambia con (2,2)=1: fila 2: 3,1,2... no; mejor fijar:
    // (0,0)=1 y (1,0)=2 vertical... En el layout, fila 0: 1,2,3,1,2 — no matches.
    // intercambiar (0,0)=1 con (1,0)=2 da columna 0: 2,1,... no match. Verificamos
    // por fuerza bruta: buscar el primer swap válido del tablero.
    const moves = possibleMoves(engine.board);
    expect(moves.length).toBeGreaterThan(0);
    const [a, b] = moves[0];
    const result = engine.attemptSwap(a, b);
    expect(result.ok).toBe(true);
    expect(engine.movesLeft).toBe(moves0 - 1);
    expect(engine.score).toBeGreaterThan(0);
    expect(result.events.some((e) => e.kind === "remove")).toBe(true);
  });

  it("no permite movimientos no adyacentes", () => {
    const engine = forcedNearMatches();
    const result = engine.attemptSwap({ r: 0, c: 0 }, { r: 0, c: 2 });
    expect(result.ok).toBe(false);
  });

  it("la misma semilla y mismas jugadas producen el mismo resultado", () => {
    const e1 = forcedNearMoves(baseLevel.seed);
    const e2 = forcedNearMoves(baseLevel.seed);
    const r1 = e1.attemptSwap({ r: 0, c: 0 }, { r: 0, c: 1 });
    const r2 = e2.attemptSwap({ r: 0, c: 0 }, { r: 0, c: 1 });
    expect(r1.ok).toBe(r2.ok);
    expect(r1.events.length).toBe(r2.events.length);
    expect(e1.score).toBe(e2.score);
    expect(boardKey(e1.board)).toBe(boardKey(e2.board));
    expect(e1.movesLeft).toBe(e2.movesLeft);
  });

  function forcedNearMoves(seed: number): Engine {
    return new Engine({ ...baseLevel, seed });
  }
});

describe("especiales", () => {
  it("4 en fila con swap horizontal crea rayada horizontal", () => {
    const engine = new Engine(simpleLevel(5, 5, 3));
    const board = engine.board;
    const layout: number[][] = [
      [1, 1, 1, 2, 1],
      [2, 3, 2, 2, 3],
      [1, 2, 3, 3, 1],
      [2, 1, 1, 3, 2],
      [3, 2, 3, 2, 1],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        board.grid[r][c] = board.makePiece(layout[r][c]);
      }
    }
    // Swap horizontal (0,3)=2 con (0,4)=1 → fila 0: 1,1,1,1 → rayada;
    // la columna del swap no forma runs verticales.
    const result = engine.attemptSwap({ r: 0, c: 3 }, { r: 0, c: 4 });
    expect(result.ok).toBe(true);
    const remove = result.events.filter((e) => e.kind === "remove")[0];
    expect(remove).toBeTruthy();
    if (remove.kind === "remove") {
      expect(remove.created).toHaveLength(1);
      expect(remove.created[0].special).toBe("stripe-h");
    }
  });

  it("expandRemovals: rayada horizontal limpia la fila, jelly y caja reaccionan", () => {
    const board = Board.createFromLevel({
      ...simpleLevel(5, 5, 3),
      blockers: [
        { kind: "crate", cells: [[2, 2]] },
        { kind: "jelly", cells: [[2, 1]] },
      ],
    });
    // Fila 2 completa con piezas normales; (2,0) es rayada horizontal.
    for (let c = 0; c < 5; c++) {
      const cell = board.makePiece(((c % 3) + 1));
      board.grid[2][c] = cell;
    }
    // La caja de (2,2) existe pero la pieza nueva no hereda el cierre: márcala.
    board.grid[2][2]!.inCrate = true;
    board.grid[2][0]!.special = "stripe-h";
    const rng = new Rng(9);
    const seeds = new Set([board.key(2, 0)]);
    const ex = expandRemovals(board, seeds, rng);
    expect(ex.triggers.some((t) => t.special === "stripe-h" && t.r === 2 && t.c === 0)).toBe(true);
    // Toda la fila 2 se elimina salvo la caja cerrada.
    for (let c = 0; c < 5; c++) {
      const key = board.key(2, c);
      if (c === 0) continue;
      if (c === 2) {
        expect(ex.removal.has(key)).toBe(false);
        expect(ex.cratesHit.has(key)).toBe(true);
      } else {
        expect(ex.removal.has(key)).toBe(true);
      }
    }
    expect(ex.triggers).toHaveLength(1);
  });

  it("expandRemovals: bomba elimina todo su color e ignora ingredientes", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const t = (r + c) % 2 === 0 ? 2 : 1;
        board.grid[r][c] = board.makePiece(t);
      }
    }
    board.grid[0][1] = board.makeIngredient();
    board.grid[2][2]!.special = "bomb";
    const ex = expandRemovals(board, new Set([board.key(2, 2)]), new Rng(3));
    // Tipo 2 (el color de la bomba) todo fuera, salvo ingrediente.
    expect(ex.triggers.some((t) => t.special === "bomb")).toBe(true);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const key = board.key(r, c);
        const isBombCell = r === 2 && c === 2;
        if ((r + c) % 2 === 0 && !isBombCell) {
          expect(ex.removal.has(key)).toBe(true);
        }
      }
    }
    expect(ex.removal.has(board.key(0, 1))).toBe(false); // ingrediente a salvo
  });

  it("5 en fila produce bomba que limpia un color completo", () => {
    const engine = new Engine(simpleLevel(5, 6, 3));
    const board = engine.board;
    // fila 0: 1 1 1 1 1 2. Colocamos directos y jugamos swap inválido no: usamos collapse.
    board.grid[0][0] = board.makePiece(1);
    board.grid[0][1] = board.makePiece(1);
    board.grid[0][2] = board.makePiece(1);
    board.grid[0][3] = board.makePiece(1);
    board.grid[0][4] = board.makePiece(2); // al introcir el swap manual con (0,4):
    // más fácil: set fila 0: 1,1,1,1,2,2 y swap (0,4)=2 con (1,4)=1 → queda fila 0: 1,1,1,1,1
    board.grid[0][5] = board.makePiece(3);
    board.grid[1][0] = board.makePiece(2);
    board.grid[1][1] = board.makePiece(3);
    board.grid[1][2] = board.makePiece(3);
    board.grid[1][3] = board.makePiece(3);
    board.grid[1][4] = board.makePiece(1);
    board.grid[1][5] = board.makePiece(2);
    board.grid[2][0] = board.makePiece(3);
    board.grid[2][1] = board.makePiece(1);
    board.grid[2][2] = board.makePiece(2);
    board.grid[2][3] = board.makePiece(1);
    board.grid[2][4] = board.makePiece(3);
    board.grid[2][5] = board.makePiece(1);
    board.grid[3][0] = board.makePiece(2);
    board.grid[3][1] = board.makePiece(3);
    board.grid[3][2] = board.makePiece(1);
    board.grid[3][3] = board.makePiece(2);
    board.grid[3][4] = board.makePiece(1);
    board.grid[3][5] = board.makePiece(3);
    board.grid[4][0] = board.makePiece(1);
    board.grid[4][1] = board.makePiece(2);
    board.grid[4][2] = board.makePiece(3);
    board.grid[4][3] = board.makePiece(3);
    board.grid[4][4] = board.makePiece(2);
    board.grid[4][5] = board.makePiece(1);

    const result = engine.attemptSwap({ r: 0, c: 4 }, { r: 1, c: 4 });
    expect(result.ok).toBe(true);
    const firstRemove = result.events.filter((e) => e.kind === "remove")[0];
    expect(firstRemove).toBeTruthy();
    if (firstRemove.kind === "remove") {
      expect(firstRemove.created.some((c) => c.special === "bomb")).toBe(true);
    }
  });

  it("cruce T/L produce wrapped", () => {
    const engine = new Engine(simpleLevel(5, 5, 3));
    const board = engine.board;
    // T: horizontal fila 1 (cols 0-2, tipo 1) + vertical col 2 (filas 0-2, tipo 1).
    const layout: number[][] = [
      [2, 3, 1, 2, 3],
      [1, 1, 1, 3, 2],
      [3, 2, 1, 2, 3],
      [1, 3, 2, 1, 2],
      [2, 1, 3, 2, 1],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        board.grid[r][c] = board.makePiece(layout[r][c]);
      }
    }
    const runs = findMatches(board);
    expect(runs).toHaveLength(2); // una horizontal y una vertical del mismo tipo
    const shapes = shapesFromRuns(runs, null, null);
    expect(shapes).toHaveLength(1); // se agrupan en una sola shape
    expect(shapes[0].creations).toHaveLength(1);
    expect(shapes[0].creations[0].special).toBe("wrapped");
    expect(shapes[0].creations[0].r).toBe(1); // celda compartida del cruce
    expect(shapes[0].creations[0].c).toBe(2);
    expect(shapes[0].cells).toHaveLength(5);
  });
});

describe("cuadros 2×2 (shapes con esquinas)", () => {
  /** Rellena con un patrón de tablero que jamás forma líneas ni cuadros. */
  function fillPattern(board: Board, rows: number, cols: number): void {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        board.grid[r][c] = board.makePiece(((r + 2 * c) % 3) + 1);
      }
    }
  }

  it("un cuadro 2×2 aislado se detecta como grupo rompible", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    fillPattern(board, 5, 5);
    // Cuadro 2×2 de tipo 2 en (0..1, 2..3).
    board.grid[0][2] = board.makePiece(2);
    board.grid[0][3] = board.makePiece(2);
    board.grid[1][2] = board.makePiece(2);
    board.grid[1][3] = board.makePiece(2);
    const matches = findMatches(board);
    expect(matches).toHaveLength(1);
    expect(matches[0].square).toBe(true);
    expect(matches[0].type).toBe(2);
    expect(matches[0].cells).toHaveLength(4);
  });

  it("un swap que completa un cuadro es válido y nace wrapped", () => {
    const engine = new Engine(simpleLevel(5, 5, 3));
    const board = engine.board;
    fillPattern(board, 5, 5);
    // fila 0: [1,2,3,2,3] y fila 1: [2,1,2,2,1] → el swap (0,1)↔(0,2)
    // deja el cuadro 2×2 de tipo 2 en (0..1, 2..3) y nada más.
    board.grid[0][0] = board.makePiece(1);
    board.grid[0][1] = board.makePiece(2);
    board.grid[0][2] = board.makePiece(3);
    board.grid[0][3] = board.makePiece(2);
    board.grid[0][4] = board.makePiece(3);
    board.grid[1][0] = board.makePiece(2);
    board.grid[1][1] = board.makePiece(1);
    board.grid[1][2] = board.makePiece(2);
    board.grid[1][3] = board.makePiece(2);
    board.grid[1][4] = board.makePiece(1);
    const moves0 = engine.movesLeft;
    const result = engine.attemptSwap({ r: 0, c: 1 }, { r: 0, c: 2 });
    expect(result.ok).toBe(true);
    expect(engine.movesLeft).toBe(moves0 - 1);
    const remove = result.events.find((e) => e.kind === "remove");
    expect(remove).toBeTruthy();
    if (remove?.kind === "remove") {
      expect(remove.created).toHaveLength(1);
      expect(remove.created[0].special).toBe("wrapped");
      expect(remove.created[0].r).toBe(0);
      expect(remove.created[0].c).toBe(2); // celda del swap dentro del cuadro
      expect(remove.cells.length).toBe(3); // el otro rincón queda como especial
    }
  });

  it("cuadro y línea del mismo color se fusionan en una bomba", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    fillPattern(board, 5, 5);
    // Línea de 4 en fila 1 (cols 0..3, tipo 1) + cuadro 2×2 en (1..2, 2..3)
    // + línea vertical col 3 (rows 0..3): 7 celdas conectadas → bomba.
    board.grid[1][0] = board.makePiece(1);
    board.grid[1][1] = board.makePiece(1);
    board.grid[1][2] = board.makePiece(1);
    board.grid[1][3] = board.makePiece(1);
    board.grid[1][4] = board.makePiece(4);
    board.grid[2][0] = board.makePiece(3);
    board.grid[2][1] = board.makePiece(2);
    board.grid[2][2] = board.makePiece(1);
    board.grid[2][3] = board.makePiece(1);
    board.grid[2][4] = board.makePiece(2);
    const runs = findMatches(board);
    expect(runs.length).toBeGreaterThanOrEqual(3); // línea 4 + vertical 4 + cuadro
    const shapes = shapesFromRuns(runs, null, null);
    expect(shapes).toHaveLength(1); // todos conectados por celdas compartidas
    expect(shapes[0].cells).toHaveLength(8); // 4 + 4 + 4 menos las celdas compartidas
    expect(shapes[0].creations).toHaveLength(1);
    expect(shapes[0].creations[0].special).toBe("bomb");
    expect(shapes[0].creations[0].r).toBe(1);
    expect(shapes[0].creations[0].c).toBe(3); // punto de cruce
  });

  it("possibleMoves incluye el swap que arma un cuadro", () => {
    const board = Board.createFromLevel(simpleLevel(5, 5, 3));
    fillPattern(board, 5, 5);
    board.grid[0][0] = board.makePiece(1);
    board.grid[0][1] = board.makePiece(2);
    board.grid[0][2] = board.makePiece(3);
    board.grid[0][3] = board.makePiece(2);
    board.grid[0][4] = board.makePiece(3);
    board.grid[1][0] = board.makePiece(2);
    board.grid[1][1] = board.makePiece(1);
    board.grid[1][2] = board.makePiece(2);
    board.grid[1][3] = board.makePiece(2);
    board.grid[1][4] = board.makePiece(1);
    const moves = possibleMoves(board);
    expect(
      moves.some(([a, b]) => a.r === 0 && a.c === 1 && b.r === 0 && b.c === 2),
    ).toBe(true);
  });

  it("el generador inicial tampoco produce cuadros", () => {
    for (const seed of [1, 7, 42, 999, 55, 1234]) {
      const board = Board.createFromLevel({ ...baseLevel, seed });
      expect(findMatches(board)).toHaveLength(0); // líneas y cuadros
    }
  });
});

describe("bloqueadores y objetivos", () => {
  function blockerLevel(): LevelDef {
    return {
      ...baseLevel,
      rows: 5,
      cols: 5,
      blockers: [
        { kind: "crate", cells: [[2, 2]] },
        { kind: "jelly", cells: [[1, 1]] },
      ],
      objectives: [{ kind: "clear", ref: 0, target: 1 }],
    };
  }

  it("la caja bloquea swap y jelly se limpia con matches", () => {
    const engine = new Engine(blockerLevel());
    const board = engine.board;
    expect(board.isLocked(2, 2)).toBe(true);
    expect(engine.objectives[0].progress).toBe(0);
    // Fuerza un match sobre (1,1): construir layout y matching.
    const layout: number[][] = [
      [1, 2, 3, 2, 1],
      [2, 1, 1, 1, 3],
      [3, 2, 1, 3, 2],
      [1, 3, 2, 1, 3],
      [2, 1, 3, 2, 1],
    ];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        board.grid[r][c] = board.makePiece(layout[r][c]);
      }
    }
    // fila 1: 2,1,1,1,3 = match de tipo 1 en (1,1)..(1,3). Elimina y barra jelly.
    const result = engine.attemptSwap({ r: 1, c: 0 }, { r: 1, c: 1 });
    expect(result.ok).toBe(true);
    expect(engine.objectives[0].progress).toBeGreaterThanOrEqual(1);
    expect(engine.jellyCount()).toBe(0);
  });

  it("el martillo elimina una pieza y encadena cascadas", () => {
    const engine = new Engine(simpleLevel(5, 5, 3));
    const moves = possibleMoves(engine.board);
    expect(moves.length).toBeGreaterThan(0);
    const before = engine.score;
    const result = engine.useHammer({ r: 0, c: 0 });
    expect(result.ok).toBe(true);
    expect(engine.score).toBeGreaterThan(before);
  });

  it("mezclador (shuffle) deja el tablero jugable y sin matches", () => {
    const engine = new Engine(simpleLevel(5, 5, 3));
    // Rompe el tablero a propósito sin matches.
    const board = engine.board;
    const bag: string[] = [];
    board.each((cell, r, c) => {
      if (cell.ingredient) return;
      bag.push(`${r},${c}:${cell.type}`);
    });
    const shuffledBoard = shufflePieces(board, new Rng(3));
    if (shuffledBoard) {
      expect(findMatches(board)).toHaveLength(0);
      expect(possibleMoves(board).length).toBeGreaterThan(0);
    }
  });
});

describe("puntuación y estrellas", () => {
  it("multiplicadores de cascada según documentación", () => {
    expect(cascadeMultiplier(0)).toBe(1);
    expect(cascadeMultiplier(1)).toBe(1.5);
    expect(cascadeMultiplier(2)).toBe(2);
    expect(cascadeMultiplier(3)).toBe(2.5);
  });

  it("estrellas según umbrales del nivel", () => {
    expect(starsForScore(900, [1000, 1800, 2600])).toBe(0);
    expect(starsForScore(1000, [1000, 1800, 2600])).toBe(1);
    expect(starsForScore(1800, [1000, 1800, 2600])).toBe(2);
    expect(starsForScore(2600, [1000, 1800, 2600])).toBe(3);
    expect(starsForScore(9999, [1000, 1800, 2600])).toBe(3);
  });
});

function boardKey(board: Board): string {
  return board.grid.map((row) => row.map((c) => (c ? String(c.type) : "")).join(",")).join("|");
}

function boardKeyOfEngine(engine: Engine): string {
  return boardKey(engine.board);
}

/* TurnResult se importa solo para tipado; no se usa en tiempo de ejecución. */
