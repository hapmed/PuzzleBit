import { describe, it, expect } from "vitest";
import { createEndlessLevel, ENDLESS_MAX } from "../endless";

const CAMPAIGN = 50;

describe("generador de niveles infinitos", () => {
  it("es determinista por id (mismo id, mismo nivel)", () => {
    const a = createEndlessLevel(51, CAMPAIGN);
    const b = createEndlessLevel(51, CAMPAIGN);
    expect(a).toEqual(b);
  });

  it("ids distintos producen niveles distintos y crece la dificultad", () => {
    // ids con objetivo de puntuación (id % 3 === 2 ⇒ depth % 3 === 0).
    const a = createEndlessLevel(53, CAMPAIGN);
    const b = createEndlessLevel(80, CAMPAIGN);
    const c = createEndlessLevel(140, CAMPAIGN);
    const scoreOfl = (lv: { objectives: Array<{ kind: string }> }) => lv.objectives[0];
    expect(scoreOfl(a).kind).toBe("score");
    expect(scoreOfl(b).kind).toBe("score");
    expect(scoreOfl(c).kind).toBe("score");
    expect(b.objectives[0].target / b.moves).toBeGreaterThan(a.objectives[0].target / a.moves);
    expect(c.objectives[0].target / c.moves).toBeGreaterThan(b.objectives[0].target / b.moves);
  });

  it("respeta siempre el esquema del motor", () => {
    for (const id of [51, 52, 55, 63, 71, 99, 101, 150, 999, 5000]) {
      const lv = createEndlessLevel(id, CAMPAIGN);
      expect(lv.id).toBe(id);
      expect(new Set([7, 8]).has(lv.rows)).toBe(true);
      expect(lv.rows).toBe(lv.cols);
      expect(lv.types).toBeGreaterThanOrEqual(4);
      expect(lv.types).toBeLessThanOrEqual(6);
      expect(lv.moves).toBeGreaterThanOrEqual(15);
      expect(lv.moves).toBeLessThanOrEqual(40);
      expect(lv.stars.every((s) => s > 0 && Number.isFinite(s))).toBe(true);
      expect(lv.stars[0]).toBeLessThan(lv.stars[1]);
      expect(lv.stars[1]).toBeLessThan(lv.stars[2]);
      for (const o of lv.objectives) {
        expect(o.target).toBeGreaterThan(0);
        if (o.kind === "collect") {
          expect(o.ref).toBeGreaterThanOrEqual(1);
          expect(o.ref!).toBeLessThanOrEqual(lv.types);
        }
      }
      // Celdas de bloqueadores dentro del tablero y sin repetir.
      for (const b of lv.blockers) {
        expect(b.cells.length).toBeGreaterThan(0);
        const keys = new Set(b.cells.map(([r, c]) => `${r},${c}`));
        expect(keys.size).toBe(b.cells.length);
        for (const [r, c] of b.cells) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(lv.rows);
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThan(lv.cols);
        }
      }
    }
  });

  it("objetivo clear: target == nº de celdas jelly", () => {
    for (let id = 53; id < 80; id += 3) {
      const lv = createEndlessLevel(id, CAMPAIGN);
      const clear = lv.objectives.find((o) => o.kind === "clear");
      const jelly = lv.blockers.find((b) => b.kind === "jelly");
      if (lv.objectives.some((o) => o.kind === "clear")) {
        expect(clear).toBeDefined();
        expect(jelly).toBeDefined();
        expect(clear!.target).toBe(jelly!.cells.length);
      }
    }
  });

  it("ingredientes: cuota coherente con el campo ingredients", () => {
    let sawIngredient = false;
    for (let id = 90; id < 130; id++) {
      const lv = createEndlessLevel(id, CAMPAIGN);
      const obj = lv.objectives.find((o) => o.kind === "ingredient");
      if (obj) {
        sawIngredient = true;
        expect(lv.ingredients).toBeDefined();
        expect(lv.ingredients!.count).toBe(obj.target);
        expect(lv.ingredients!.every).toBeGreaterThanOrEqual(5);
      }
    }
    expect(sawIngredient).toBe(true);
  });

  it("rechaza ids de campaña y fuera de rango", () => {
    expect(() => createEndlessLevel(50, CAMPAIGN)).toThrow();
    expect(() => createEndlessLevel(1, CAMPAIGN)).toThrow();
    expect(() => createEndlessLevel(ENDLESS_MAX + 1, CAMPAIGN)).toThrow();
    expect(() => createEndlessLevel(51, CAMPAIGN)).not.toThrow();
  });
});
