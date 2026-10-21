/** Reglas de puntuación, puras y testeables. */

export const POINTS_PER_PIECE = 10;
export const SPECIAL_CREATION_BONUS = 60;
export const SPECIAL_TRIGGER_BONUS = 30;
export const INGREDIENT_BONUS = 100;
export const JELLY_BONUS = 50;
export const MOVES_LEFT_BONUS = 60;

/** Multiplicador de cascada: paso base ×1, primer repetido ×1.5, ×2, … */
export function cascadeMultiplier(step: number): number {
  if (step <= 0) return 1;
  return 1 + 0.5 * step;
}

export function blockPoints(count: number, step: number): number {
  return Math.round(POINTS_PER_PIECE * count * cascadeMultiplier(step));
}

export function starsForScore(score: number, thresholds: [number, number, number]): number {
  let stars = 0;
  for (const t of thresholds) if (score >= t) stars++;
  return stars;
}

export function finalScoreWithMovesLeft(score: number, movesLeft: number): number {
  return score + movesLeft * MOVES_LEFT_BONUS;
}
