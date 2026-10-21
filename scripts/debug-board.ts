import { Board } from "../src/game/engine/board";
import { findMatches } from "../src/game/engine/match";
import type { LevelDef } from "../src/game/levels";

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

const board = Board.createFromLevel(baseLevel);
const matches = findMatches(board);
console.log("matches:", matches.length);
for (const m of matches.slice(0, 6)) {
  console.log(m.type, m.horizontal, m.cells.map((p) => `${p.r},${p.c}`).join(" "));
}
console.log(
  board.grid.map((row) => row.map((c) => (c ? c.type : "-")).join(" ")).join("\n"),
);
