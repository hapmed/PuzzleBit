/**
 * Generador de niveles de PuzzleBit (50 niveles progresivos con
 * puntuación, recolección, jelly y desde el 30 una pieza de ingrediente).
 * Salida: data/levels.json (determinista).
 */
const fs = require("node:fs");
const path = require("node:path");

const N = 50;

const NAMES = [
  "Primer bocado", "Dulce línea", "Combo blando", "Cascada corta", "Menta fuerte",
  "Caramelo duro", "Doble giro", "Chispa", "Azúcar alta", "Bit quebrado",
  "Eco de gema", "Prisma", "Torrente", "Kraken suave", "Faro",
  "Laberinto breve", "Salto cuántico", "Pulso", "Neón", "Mosaico",
  "Vórtice", "Prisma doble", "Serpiente lenta", "Roble", "Eco del eco",
  "Espejo", "Cazador de filas", "Cráter", "Aurora", "Bajo cero",
  "Corral", "Umbral", "Reloj de arena", "Sobresalto", "Conjuro",
  "Templo", "Gravedad leve", "Farolillo", "Pulso doble", "Bastión",
  "Cañón floral", "Mareas", "Retroceso", "Cisne", "Fragua",
  "Cristal violeta", "Tormenta", "Defensa final", "Bit dorado", "PuzzleBit",
];

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevel(idx) {
  const id = idx + 1;
  const seed = 100 + id * 7 + (id % 3) * 11;
  const rng = mulberry32(seed);

  // Progresión de mecánicas.
  const scoreOnly = id < 12;
  const withJelly = id >= 12 && (id % 2 === 0 || id >= 25);
  const withCrates = id >= 18 && id % 3 !== 0;
  const withIngredients = id >= 30 && id % 5 === 0;

  const rows = 8;
  const cols = 8;
  const types = id <= 10 ? 5 : 6;

  // Bloqueadores primero: el objetivo de jelly usa las celdas reales.
  const blockers = [];
  let jellyCells = [];
  if (withJelly) {
    const wanted = 3 + Math.floor(rng() * 4);
    jellyCells = [];
    for (let k = 0; k < 40 && jellyCells.length < wanted; k++) {
      const r = 2 + Math.floor(rng() * (rows - 3));
      const c = Math.floor(rng() * cols);
      if (!jellyCells.some(([jr, jc]) => jr === r && jc === c)) jellyCells.push([r, c]);
    }
    if (jellyCells.length) blockers.push({ kind: "jelly", cells: jellyCells });
  }
  if (withCrates) {
    const count = 1 + Math.floor(rng() * 2);
    const cells = [];
    for (let k = 0; k < 40 && cells.length < count; k++) {
      const r = 1 + Math.floor(rng() * (rows - 2));
      const c = Math.floor(rng() * cols);
      const hasJelly = jellyCells.some(([jr, jc]) => jr === r && jc === c);
      if (!hasJelly && !cells.some(([cr, cc]) => cr === r && cc === c)) cells.push([r, c]);
    }
    if (cells.length) blockers.push({ kind: "crate", cells });
  }

  // Objetivos.
  let objectives;
  let starsBase;
  if (scoreOnly || id % 4 === 1) {
    const target = 800 + id * 140;
    objectives = [{ kind: "score", target }];
    starsBase = target;
  } else if (withIngredients) {
    const count = 2 + Math.floor(rng() * 2);
    objectives = [
      { kind: "ingredient", ref: 0, target: count },
      { kind: "score", target: 1400 + id * 100 },
    ];
    starsBase = 1400 + id * 100;
  } else if (jellyCells.length >= 3 && (id % 3 === 2 || id >= 40)) {
    const ref = 1 + Math.floor(rng() * types);
    objectives = [
      { kind: "collect", ref, target: 12 + Math.floor(id / 2) },
      { kind: "score", target: 1600 + id * 120 },
    ];
    starsBase = 1600 + id * 120;
  } else if (jellyCells.length > 0) {
    objectives = [
      { kind: "clear", ref: 0, target: jellyCells.length },
      { kind: "score", target: 1200 + id * 100 },
    ];
    starsBase = 1200 + id * 100;
  } else {
    const target = 1000 + id * 160;
    objectives = [{ kind: "score", target }];
    starsBase = target;
  }

  // (los bloqueadores ya se construyeron arriba)

  const moves = Math.max(15, Math.round(24 - id / 3 + (objectives.length > 1 ? 4 : 0)));
  const stars = [starsBase, Math.round(starsBase * 1.7), Math.round(starsBase * 2.5)];

  const level = {
    id,
    name: NAMES[idx],
    seed,
    rows,
    cols,
    types,
    moves,
    objectives,
    stars,
    blockers,
  };
  if (withIngredients) {
    level.ingredients = {
      count: objectives[0]?.kind === "ingredient" ? objectives[0].target : 2,
      every: 4,
    };
  }
  return level;
}

const levels = [];
for (let i = 0; i < N; i++) levels.push(buildLevel(i));

const out = { version: 2, levels };
const target = path.join(__dirname, "..", "data", "levels.json");
fs.writeFileSync(target, JSON.stringify(out, null, 2) + "\n");
console.log(`escritos ${levels.length} niveles en data/levels.json`);
