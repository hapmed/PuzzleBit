/** Tipos compartidos de la definición de niveles (fuente común cliente/backend). */

export type SpecialKind = "none" | "stripe-h" | "stripe-v" | "wrapped" | "bomb" | "dice";
export type BlockerKind = "crate" | "jelly";
export type ObjectiveKind = "score" | "collect" | "clear" | "ingredient";

export interface Objective {
  kind: ObjectiveKind;
  /** score: puntos; collect: tipo de pieza (1..types); clear: tipo de bloqueador; ingredient: 0. */
  ref?: number;
  target: number;
}

export interface BlockerSpec {
  kind: BlockerKind;
  /** HP inicial por celda (crate); jelly usa layers. */
  cells: Array<[number, number]>;
}

export interface LevelDef {
  id: number;
  name: string;
  seed: number;
  rows: number;
  cols: number;
  types: number;
  moves: number;
  objectives: Objective[];
  stars: [number, number, number];
  blockers: BlockerSpec[];
  /** Objetivos de ingredientes: cuántos repartir y cada cuántas tiradas del dispensador. */
  ingredients?: { count: number; every: number };
  /** Reto diario (no forma parte de la campaña). */
  daily?: boolean;
}

export function parseLevel(raw: unknown): LevelDef {
  const r = raw as Record<string, unknown>;
  const starsRaw = r.stars as number[];
  const objectives = (r.objectives as Array<Record<string, unknown>>).map((o) => ({
    kind: o.kind as ObjectiveKind,
    ref: o.ref as number | undefined,
    target: o.target as number,
  }));
  const defs: LevelDef = {
    id: r.id as number,
    name: r.name as string,
    seed: r.seed as number,
    rows: r.rows as number,
    cols: r.cols as number,
    types: r.types as number,
    moves: r.moves as number,
    objectives,
    stars: [starsRaw[0], starsRaw[1], starsRaw[2]],
    blockers: ((r.blockers as Array<Record<string, unknown>>) ?? []).map((b) => ({
      kind: b.kind as BlockerKind,
      cells: b.cells as Array<[number, number]>,
    })),
  };
  if (r.ingredients) {
    const ing = r.ingredients as { count: number; every: number };
    defs.ingredients = { count: ing.count, every: ing.every };
  }
  if (r.daily) defs.daily = true;
  return defs;
}

export function parseLevelCatalog(raw: { version: number; levels: unknown[] }): LevelDef[] {
  return raw.levels.map(parseLevel).filter((l) => !l.daily);
}
