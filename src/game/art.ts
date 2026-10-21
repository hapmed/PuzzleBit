import Phaser from "phaser";

/**
 * Arte pixel generado en runtime: piezas 48×48, especiales, overlays de
 * bloqueadores, estrella y fondo. Sin assets externos y todo original.
 */

interface Painter {
  (b: PixelGrid, color: string, light: string, dark: string): void;
}

class PixelGrid {
  map = new Map<string, string>();

  set(x: number, y: number, color: string): void {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) this.map.set(`${x},${y}`, color);
  }

  get(x: number, y: number): string {
    return this.map.get(`${x},${y}`) ?? "transparent";
  }

  rows(): string[][] {
    const out: string[][] = [];
    for (let y = 0; y < 16; y++) {
      const row: string[] = [];
      for (let x = 0; x < 16; x++) row.push(this.get(x, y));
      out.push(row);
    }
    return out;
  }
}

const PIECES: Array<{ color: string; light: string; dark: string; painterIdx: number }> = [
  { color: "#ff5fa2", light: "#ffb2d2", dark: "#c2336d", painterIdx: 0 },
  { color: "#ffe14d", light: "#fff09a", dark: "#d1a900", painterIdx: 1 },
  { color: "#4dd6a0", light: "#a8f7d3", dark: "#109b6b", painterIdx: 0 },
  { color: "#4da3ff", light: "#a8cbff", dark: "#1c63d9", painterIdx: 1 },
  { color: "#b06bff", light: "#d3aaff", dark: "#7a2ed6", painterIdx: 2 },
  { color: "#ff9a3d", light: "#ffce96", dark: "#e05b00", painterIdx: 3 },
];

/** Tint por tipo de pieza (índice 1..6) para partículas y detalles. */
export const PIECE_TINTS: number[] = [0xffffff, 0xff5fa2, 0xffe14d, 0x4dd6a0, 0x4da3ff, 0xb06bff, 0xff9a3d];

const disc: Painter = (b, color, light, dark) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2);
      if (d <= 6.2) {
        b.set(x, y, color);
        if (d <= 3.4 && x + y <= 12 && x - y <= 0) b.set(x, y, light);
      } else if (d <= 7) {
        b.set(x, y, dark);
      }
    }
  }
};

const square: Painter = (b, color, light, dark) => {
  for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) b.set(x, y, color);
  for (let x = 4; x < 10; x++) b.set(x, 3, light);
  for (let y = 4; y < 10; y++) b.set(3, y, light);
  for (let x = 4; x < 13; x++) b.set(x, 12, dark);
  for (let y = 4; y < 13; y++) b.set(12, y, dark);
  for (let x = 3; x < 13; x++) b.set(x, 4, color);
};

const diamond: Painter = (b, color, light, dark) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d <= 6) {
        b.set(x, y, color);
        if (x + y <= 13) b.set(x, y, light);
      } else if (d <= 7) {
        b.set(x, y, dark);
        if (x + y <= 15) b.set(x, y, light);
      }
    }
  }
};

const plus: Painter = (b, color, light, dark) => {
  for (let x = 5; x < 11; x++) for (let y = 1; y < 15; y++) b.set(x, y, color);
  for (let y = 5; y < 11; y++) for (let x = 1; x < 15; x++) b.set(x, y, color);
  for (let x = 5; x < 11; x++) b.set(x, 2, light);
  for (let y = 5; y < 11; y++) b.set(2, y, light);
  for (let x = 5; x < 11; x++) b.set(x, 13, dark);
  for (let y = 5; y < 11; y++) b.set(13, y, dark);
};

const drop: Painter = (b, color, light, dark) => {
  for (let y = 3; y < 13; y++) {
    for (let x = 4; x < 12; x++) {
      if (x >= 4 && x <= 11 && y >= 4 && y <= 11) b.set(x, y, color);
    }
  }
  for (let x = 6; x < 10; x++) b.set(x, 2, color);
  b.set(7, 1, color);
  b.set(8, 1, color);
  for (let x = 5; x < 12; x++) b.set(x, 10, dark);
  for (let y = 5; y < 10; y++) {
    b.set(5, y, light);
    b.set(10, y, dark);
  }
  for (let y = 4; y < 9; y++) b.set(9, y, light);
};

const PAINTERS: Painter[] = [disc, square, diamond, plus, drop];

const stripeOverlayColor: Painter = (b) => {
  for (let i = 3; i < 14; i += 4) {
    for (let x = 2; x < 14; x++) b.set(x, i, "#ffffff");
  }
};

const stripeOverlayMono: Painter = (b) => {
  for (let i = 3; i < 14; i += 4) {
    for (let y = 2; y < 14; y++) b.set(i, y, "#ffffff99");
  }
};

const wrappedOverlay: Painter = (b) => {
  for (const i of [2, 3, 12, 13]) {
    for (let j = 2; j < 14; j++) {
      b.set(i, j, "#ffffff");
      b.set(j, i, "#ffffff");
    }
  }
};

const bombOverlay: Painter = (b, color) => {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.sqrt((x - 7.5) ** 2 + (y - 7.5) ** 2);
      if (d <= 6.2) b.set(x, y, "#2a2140");
      else if (d <= 7) b.set(x, y, "#150f26");
    }
  }
  for (let i = 0; i < 4; i++) {
    b.set(8 - i, 3 + i, "#fff");
    b.set(4 + i, 9 + i, color);
    b.set(10 - i, 10 + i, color);
  }
};

/** Dado: marco blanco + 5 puntos, sobre la pieza de base. */
const diceOverlay: Painter = (b) => {
  for (let i = 2; i < 14; i++) {
    b.set(i, 2, "#ffffff");
    b.set(i, 13, "#ffffff");
    b.set(2, i, "#ffffff");
    b.set(13, i, "#ffffff");
  }
  for (const [px, py] of [[5, 5], [10, 5], [7, 7], [5, 10], [10, 10]]) {
    b.set(px, py, "#ffffff");
    b.set(px, py + 1, "#ffffff");
  }
};

function paintTexture(scene: Phaser.Scene, key: string, rows: string[][], scale: number): void {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  if (!w) return;
  const tex = scene.textures.createCanvas(key, w * scale, h * scale);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w * scale, h * scale);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = rows[y][x];
      if (color === "transparent") continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  tex.refresh();
}

export function createGameTextures(scene: Phaser.Scene): void {
  const SCALE = 3; // 16 px lógicos → 48 px
  const nShapes = PAINTERS.length;
  for (let i = 0; i < PIECES.length; i++) {
    const info = PIECES[i];
    const base = PAINTERS[i % nShapes];
    const cds: Array<[string, Painter | null]> = [
      [`piece${i + 1}`, null],
      [`piece${i + 1}-stripe-h`, stripeOverlayColor],
      [`piece${i + 1}-stripe-v`, stripeOverlayMono],
      [`piece${i + 1}-wrapped`, wrappedOverlay],
      [`piece${i + 1}-dice`, diceOverlay],
    ];
    for (const [key, overlay] of cds) {
      const g = new PixelGrid();
      base(g, info.color, info.light, info.dark);
      if (overlay) overlay(g, info.color, info.light, info.dark);
      paintTexture(scene, key, g.rows(), SCALE);
    }
  }

  const gb = new PixelGrid();
  bombOverlay(gb, "#ffd95e", "#ffd95e", "#8a6a00");
  paintTexture(scene, "piece-bomb", gb.rows(), SCALE);

  const gi = new PixelGrid();
  drop(gi, "#ffd95e", "#fff4b8", "#c98f00");
  paintTexture(scene, "piece-ingredient", gi.rows(), SCALE);

  // Overlay caja (madera oscura).
  const gc = new PixelGrid();
  for (let i = 2; i < 14; i++) {
    gc.set(i, 2, "#a9743d");
    gc.set(i, 13, "#a9743d");
    gc.set(2, i, "#a9743d");
    gc.set(13, i, "#a9743d");
  }
  for (let i = 5; i < 11; i++) {
    gc.set(i, 7, "#7a5227");
    gc.set(7, i, "#7a5227");
  }
  for (let i = 3; i < 13; i += 3) {
    gc.set(i, 3, "#d9a15c");
    gc.set(3, i, "#d9a15c");
  }
  paintTexture(scene, "overlay-crate", gc.rows(), SCALE);

  // Overlay jelly translúcido.
  const gj = new PixelGrid();
  for (let y = 1; y < 15; y++) {
    for (let x = 1; x < 15; x++) {
      if ((x === 1 || x === 14 || y === 1 || y === 14) && (x + y) % 2 === 0) gj.set(x, y, "#8ad9ff");
      else if (x === 4 && y < 7) gj.set(x, y, "#cfeaff");
    }
  }
  paintTexture(scene, "overlay-jelly", gj.rows(), SCALE);

  // Estrella.
  const star = [
    [7, 1], [8, 1],
    [7, 2], [8, 2],
    [6, 3], [7, 3], [8, 3], [9, 3],
    [1, 4], [2, 4], [6, 4], [7, 4], [8, 4], [9, 4], [13, 4], [14, 4],
    [2, 5], [3, 5], [6, 5], [7, 5], [8, 5], [9, 5], [12, 5], [13, 5],
    [3, 6], [4, 6], [5, 6], [6, 6], [9, 6], [10, 6], [11, 6], [12, 6],
    [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
    [4, 8], [5, 8], [10, 8], [11, 8],
    [3, 9], [4, 9], [11, 9], [12, 9],
    [2, 10], [13, 10],
    [1, 11], [14, 11],
  ];
  const gs = new PixelGrid();
  for (const [x, y] of star) gs.set(x, y, "#ffd95e");
  for (const [x, y] of star) {
    if (y <= 7) gs.set(x, y, x + y <= 10 ? "#fff09a" : "#ffd95e");
  }
  paintTexture(scene, "star", gs.rows(), 3);

  // Fondo degradado por bandas con estrellas tenues.
  const w = 360;
  const h = 640;
  const tex = scene.textures.createCanvas("bg", w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  const stops = ["#14102b", "#1b1538", "#221a45", "#2a204f", "#1b1538", "#14102b"];
  const band = h / stops.length;
  for (let i = 0; i < stops.length; i++) {
    ctx.fillStyle = stops[i];
    ctx.fillRect(0, Math.floor(i * band), w, Math.ceil(band) + 1);
  }
  let seed = 1234;
  const rnd = () => {
    seed = (seed * 16807 + 1) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * h);
    const s = rnd() < 0.15 ? 2 : 1;
    ctx.fillStyle = rnd() < 0.3 ? "#8f86c2" : "#5d548f";
    ctx.fillRect(x, y, s, s);
  }
  tex.refresh();
}

export function textureForPiece(type: number, special: string): string {
  if (special === "bomb") return "piece-bomb";
  if (special === "dice") return `piece${type}-dice`;
  if (special === "stripe-h") return `piece${type}-stripe-h`;
  if (special === "stripe-v") return `piece${type}-stripe-v`;
  if (special === "wrapped") return `piece${type}-wrapped`;
  return `piece${type}`;
}

export const INGREDIENT_TEXTURE = "piece-ingredient";
