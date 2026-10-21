/**
 * Genera los iconos PWA de PuzzleBit PNG a 192 y 512 px:
 * pixel art de una pieza de PuzzleBit (gema rosa con estrella) escaneada
 * por una cuadrícula 16x16 reescalada. Salida en public/icons/.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const W = 16;
const C = {
  bg1: "#14102b",
  bg2: "#221a45",
  pink: "#ff5fa2",
  pinkLight: "#ffb2d2",
  pinkDark: "#c2336d",
  yellow: "#ffe14d",
  white: "#ffffff",
  purple: "#6a56ad",
};

const ART = [
  "BBBBBBBBBBBBBBBB",
  "Bppppppppppppppp",
  "BppppPPPPPPppppB",
  "PppDDPPWWWWDDppp",
  "PppDPPDWWWWPDDpp",
  "ppPPPPDWWWWPPPPp",
  "ppPDOODDDDDOOOPp",
  "ppDPOPPPOOPOOOPp",
  "ppPPPOPOOPOPPOPp",
  "ppPPOPOOPOOOPPPp",
  "ppYYOPOOPOPOPPPp",
  "ppPYYOOOPOOOPPOp",
  "ppYYYPPPOOOPPPPp",
  "ppYYPPPPPPPPPPpp",
  "pPYYYYYYYYYYYYPP",
  "PPPPPPPPPPPPPPPP",
];

function colorFor(ch, x, y) {
  const checker = (x + y) % 2 === 0 ? C.bg1 : C.bg2;
  switch (ch) {
    case "B": return checker;
    case "p": return C.pink;
    case "P": return C.pinkDark;
    case "D": return C.pinkLight;
    case "W": return C.white;
    case "O": return C.pinkLight;
    case "Y": return C.yellow;
    default: return C.bg1;
  }
}

function pngEncodeRGBA(pixels, w, h) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks = [];

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, "ascii");
    const crcBuf = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcBuf) >>> 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  chunks.push(chunk("IHDR", ihdr));

  // IDAT — filtro 0 en cada fila.
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixels[y][x];
      const off = y * (w * 4 + 1) + 1 + x * 4;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
      raw[off + 3] = a;
    }
  }
  chunks.push(chunk("IDAT", zlib.deflateSync(raw, { level: 9 })));

  chunks.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat([signature, ...chunks]);
}

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function makeIcon(scale) {
  const size = W * scale;
  const pixels = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const cell = colorFor(ART[Math.floor(y / scale)][Math.floor(x / scale)], Math.floor(x / scale), Math.floor(y / scale));
      row.push([...hexToRgb(cell), 255]);
    }
    pixels.push(row);
  }
  return pngEncodeRGBA(pixels, size, size);
}

for (const size of [192, 512, 180]) {
  const buf = makeIcon(Math.floor(size / W));
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log("escrito", name, buf.length, "bytes");
}
