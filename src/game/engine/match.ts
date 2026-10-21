import type { Board } from "./board";
import type { BoardPosition } from "./board";

/** Un match horizontal o vertical de 3+ piezas del mismo tipo. */
export interface Run {
  cells: BoardPosition[];
  horizontal: boolean;
  type: number;
}

/**
 * Detecta todos los runs (líneas de 3 o más) del tablero.
 * Ignora ingredientes, celdas en caja y celdas vacías o de tipo 0.
 */
export function findMatches(board: Board): Run[] {
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

/** Indica si un run contiene una posición dada. */
export function runHas(run: Run, r: number, c: number): boolean {
  return run.cells.some((p) => p.r === r && p.c === c);
}
