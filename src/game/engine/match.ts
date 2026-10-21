import type { Board } from "./board";
import type { BoardPosition } from "./board";

/** Un grupo que se rompe: línea de 3+ o cuadro 2×2 del mismo tipo. */
export interface Run {
  cells: BoardPosition[];
  horizontal: boolean;
  type: number;
  /** true si el grupo es un cuadro 2×2 en vez de una línea. */
  square?: boolean;
}

/**
 * Detecta todos los grupos rompibles: líneas de 3+ y cuadros 2×2.
 * Ignora ingredientes, celdas en caja y celdas vacías o de tipo 0.
 */
export function findMatches(board: Board): Run[] {
  return [...findRuns(board), ...findSquares(board)];
}

/** Detecta solo las líneas (horizontales y verticales) de 3 o más. */
function findRuns(board: Board): Run[] {
  const runs: Run[] = [];

  const samePiece = (r: number, c: number): number | null => {
    const cell = board.grid[r][c];
    if (!cell || cell.inCrate || cell.ingredient || cell.type <= 0) return null;
    return cell.type;
  };

  // Horizontales.
  for (let r = 0; r < board.rows; r++) {
    let start: number | null = null;
    let runType = 0;
    for (let c = 0; c <= board.cols; c++) {
      const t = c < board.cols ? samePiece(r, c) : null;
      if (t !== null) {
        if (start === null) {
          start = c;
          runType = t;
        }
        if (t !== runType) {
          if (c - start >= 3) {
            const runCells: BoardPosition[] = [];
            for (let cc = start; cc < c; cc++) runCells.push({ r, c: cc });
            runs.push({ cells: runCells, horizontal: true, type: runType });
          }
          start = c;
          runType = t;
        }
      } else if (start !== null) {
        if (c - start >= 3) {
          const runCells: BoardPosition[] = [];
          for (let cc = start; cc < c; cc++) runCells.push({ r, c: cc });
          runs.push({ cells: runCells, horizontal: true, type: runType });
        }
        start = null;
      }
    }
  }

  // Verticales.
  for (let c = 0; c < board.cols; c++) {
    let start: number | null = null;
    let runType = 0;
    for (let r = 0; r <= board.rows; r++) {
      const t = r < board.rows ? samePiece(r, c) : null;
      if (t !== null) {
        if (start === null) {
          start = r;
          runType = t;
        }
        if (t !== runType) {
          if (r - start >= 3) {
            const runCells: BoardPosition[] = [];
            for (let rr = start; rr < r; rr++) runCells.push({ r: rr, c });
            runs.push({ cells: runCells, horizontal: false, type: runType });
          }
          start = r;
          runType = t;
        }
      } else if (start !== null) {
        if (r - start >= 3) {
          const runCells: BoardPosition[] = [];
          for (let rr = start; rr < r; rr++) runCells.push({ r: rr, c });
          runs.push({ cells: runCells, horizontal: false, type: runType });
        }
        start = null;
      }
    }
  }

  return runs;
}

/**
 * Detecta todos los cuadros 2×2 (4 piezas iguales). Cada esquina emite su
 * cuadro aunque se solape con otro: shapesFromRuns los fusiona.
 */
export function findSquares(board: Board): Run[] {
  const squares: Run[] = [];

  const samePiece = (r: number, c: number): number | null => {
    const cell = board.grid[r][c];
    if (!cell || cell.inCrate || cell.ingredient || cell.type <= 0) return null;
    return cell.type;
  };

  for (let r = 0; r + 1 < board.rows; r++) {
    for (let c = 0; c + 1 < board.cols; c++) {
      const t = samePiece(r, c);
      if (t === null) continue;
      if (samePiece(r, c + 1) === t && samePiece(r + 1, c) === t && samePiece(r + 1, c + 1) === t) {
        squares.push({
          cells: [
            { r, c },
            { r, c: c + 1 },
            { r: r + 1, c },
            { r: r + 1, c: c + 1 },
          ],
          horizontal: false,
          type: t,
          square: true,
        });
      }
    }
  }
  return squares;
}

/** Indica si un run contiene una posición dada. */
export function runHas(run: Run, r: number, c: number): boolean {
  return run.cells.some((p) => p.r === r && p.c === c);
}
