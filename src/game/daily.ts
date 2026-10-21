import type { LevelDef } from "./levels";
import { todayDateString } from "./state";

/** Nivel del reto diario: determinista a partir de la fecha. */
export function createDailyLevel(): LevelDef {
  const date = todayDateString();
  let seed = 0x24601;
  for (let i = 0; i < date.length; i++) {
    seed = (Math.imul(seed + date.charCodeAt(i), 31) >>> 0) % 2147483647;
  }
  const rotate = [
    ["Ronda del alba", "Pegamento de la tarde", "Cascada nocturna", "Bit quebrado"],
    [1400, 2800, 4600],
  ];
  const dayMod = Math.abs(seed) % 5;
  return {
    id: -1,
    name: `${rotate[0][dayMod % rotate[0].length]}`,
    seed,
    rows: 8,
    cols: 8,
    types: 5 + (Math.abs(seed) % 2),
    moves: 22,
    objectives: [
      { kind: "score", target: 2600 },
      { kind: "collect", ref: 1 + (Math.abs(seed) % 5), target: 18 },
    ],
    stars: [2600, 5200, 7800],
    blockers: [
      { kind: "jelly", cells: [[3, 3], [3, 4], [4, 3], [4, 4]] },
    ],
  };
}
