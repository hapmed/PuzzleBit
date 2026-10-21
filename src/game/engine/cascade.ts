import type { Board } from "./board";
import { Rng } from "./random";

/** Evento de caída: una pieza se mueve de (from) a (to). */
export interface FallEvent {
  id: number;
  from: { r: number; c: number };
  to: { r: number; c: number };
}

export interface SpawnEvent {
  id: number;
  type: number;
  col: number;
  /** Fila final tras la caída. */
  row: number;
}

export interface IngredientSpawnEvent {
  id: number;
  col: number;
}

export interface GravityResult {
  falls: FallEvent[];
  spawns: SpawnEvent[];
  ingredientSpawns: IngredientSpawnEvent[];
}

/**
 * Aplica gravedad columna a columna, con nuevo relleno sembrado arriba.
 * Devuelve el registro de caídas y spawns para animar la vista.
 */
export function applyGravity(board: Board, rng: Rng): GravityResult {
  const falls: FallEvent[] = [];
  const spawns: SpawnEvent[] = [];
  const ingredientSpawns: IngredientSpawnEvent[] = [];

  for (let c = 0; c < board.cols; c++) {
    // Empuja hacia abajo dentro de la columna (ingredientes y piezas caen igual).
    let write = board.rows - 1;
    for (let r = board.rows - 1; r >= 0; r--) {
      const cell = board.grid[r][c];
      if (!cell) continue;
      if (r !== write) {
        board.grid[write][c] = cell;
        board.grid[r][c] = null;
        falls.push({ id: cell.id, from: { r, c }, to: { r: write, c } });
      }
      write--;
    }

    // Relleno desde arriba.
    for (let r = write; r >= 0; r--) {
      // ¿Dispensador de ingredientes?
      if (
        board.ingredientEvery > 0 &&
        board.ingredientsQuota - board.ingredientsCollected - countIngredientsOnBoard(board) > 0 &&
        board.nextIngredientIn === 0 &&
        r === 0
      ) {
        const ing = board.makeIngredient();
        board.grid[r][c] = ing;
        board.nextIngredientIn = board.ingredientEvery;
        ingredientSpawns.push({ id: ing.id, col: c });
        // El ingrediente también cae hasta asentarse: aparte, lo movemos ya.
        continue;
      }
      const cell = board.makePiece(1 + rng.int(board.types));
      board.grid[r][c] = cell;
      spawns.push({ id: cell.id, type: cell.type, col: c, row: r });
    }

    // Deja caer los ingredientes spawn hasta el asiento.
    for (let r = 0; r < board.rows; r++) {
      const cell = board.grid[r][c];
      if (cell?.ingredient && r === 0 && !falls.some((f) => f.id === cell.id)) {
        let target = r;
        while (target + 1 < board.rows && board.grid[target + 1][c] === null) target++;
        if (target !== r) {
          board.grid[target][c] = cell;
          board.grid[r][c] = null;
          falls.push({ id: cell.id, from: { r, c }, to: { r: target, c } });
        }
      }
    }
  }

  if (board.nextIngredientIn > 0) board.nextIngredientIn--;

  return { falls, spawns, ingredientSpawns };
}

function countIngredientsOnBoard(board: Board): number {
  let n = 0;
  board.each((cell) => {
    if (cell.ingredient) n++;
  });
  return n;
}
