/**
 * Genera efectos de audio cortos en WAV PCM 8 bits (chiptune simple)
 * para PuzzleBit: click, swap, match, especial, win y lose.
 */
const fs = require("node:fs");
const path = require("node:path");

const OUT_DIR = path.join(__dirname, "..", "public", "audio");
fs.mkdirSync(OUT_DIR, { recursive: true });

const RATE = 22050;

function writeWav(name, samples) {
  const dataLen = samples.length;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < dataLen; i++) {
    buf[44 + i] = Math.max(0, Math.min(255, Math.round(128 + samples[i] * 127)));
  }
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  console.log("escrito", name);
}

function tone({ dur, f0, f1, shape = "square", vol = 0.5, decay = true }) {
  const n = Math.floor(RATE * dur);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const freq = f0 + (f1 - f0) * (i / n);
    const ph = Math.floor(t * freq) % 1;
    let s;
    if (shape === "square") s = ph < 0.5 ? 1 : -1;
    else if (shape === "tri") s = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    else s = Math.sin(t * freq * 2 * Math.PI);
    const env = decay ? Math.pow(1 - i / n, 1.4) : 1;
    out[i] = s * env * vol;
  }
  return out;
}

function silence(dur) {
  return new Array(Math.floor(RATE * dur)).fill(0);
}

function concat(parts) {
  const total = parts.reduce((a, b) => a + b.length, 0);
  const out = new Array(total).fill(0);
  let i = 0;
  for (const p of parts) {
    for (let j = 0; j < p.length; j++) out[i + j] += p[j];
    i += p.length;
  }
  return out;
}

function mix(...parts) {
  const total = Math.max(...parts.map((p) => p.length));
  const out = new Array(total).fill(0);
  for (const p of parts) for (let j = 0; j < p.length; j++) out[j] += p[j];
  return out;
}

writeWav("click.wav", tone({ dur: 0.06, f0: 660, f1: 880, vol: 0.35 }));
writeWav("swap.wav", [0], tone({ dur: 0.12, f0: 350, f1: 700, shape: "tri", vol: 0.4 }));
writeWav("match.wav", concat([
  tone({ dur: 0.08, f0: 523, f1: 523, shape: "square", vol: 0.35 }),
  tone({ dur: 0.08, f0: 659, f1: 659, shape: "square", vol: 0.35 }),
  tone({ dur: 0.1, f0: 784, f1: 784, shape: "square", vol: 0.35 }),
]));
writeWav("cascade.wav", concat([
  tone({ dur: 0.07, f0: 400, f1: 500, vol: 0.3 }),
  tone({ dur: 0.07, f0: 500, f1: 640, vol: 0.3 }),
  tone({ dur: 0.12, f0: 640, f1: 820, vol: 0.3 }),
]));
writeWav("special.wav", concat([
  tone({ dur: 0.06, f0: 900, f1: 1300, shape: "square", vol: 0.4 }),
  silence(0.03),
  tone({ dur: 0.16, f0: 600, f1: 1500, shape: "sine", vol: 0.35 }),
]));
writeWav("win.wav", concat([
  tone({ dur: 0.12, f0: 523, f1: 523, vol: 0.4 }),
  tone({ dur: 0.12, f0: 659, f1: 659, vol: 0.4 }),
  tone({ dur: 0.12, f0: 784, f1: 784, vol: 0.4 }),
  tone({ dur: 0.28, f0: 880, f1: 1046, vol: 0.45 }),
]));
writeWav("lose.wav", concat([
  tone({ dur: 0.18, f0: 400, f1: 340, shape: "tri", vol: 0.4 }),
  tone({ dur: 0.3, f0: 300, f1: 180, shape: "tri", vol: 0.4 }),
]));

// Música loop corta y transparente (arpegio alegre).
const musicBars = [];
const freqs = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 523.25, 659.25, 783.99, 1046.5];
for (const f of freqs) {
  musicBars.push(tone({ dur: 0.22, f0: f, f1: f, shape: "tri", vol: 0.12, decay: false }));
}
writeWav("music.wav", mix(musicBars.filter((_, i) => i % 3 === 0), musicBars.filter((_, i) => i % 3 !== 0)));
