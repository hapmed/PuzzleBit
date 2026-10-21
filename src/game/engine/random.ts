/**
 * PRNG determinista (mulberry32) para el motor de juego.
 * Toda la aleatoriedad del tablero pasa por aquí para que un nivel
 * con la misma semilla produzca siempre el mismo resultado.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x2f6e2b1;
  }

  /** Float en [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive) % maxExclusive;
  }

  /** Elemento aleatorio de un array no vacío. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** Fisher-Yates in place (copia nueva). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}

/** Deriva una semilla hija determinista de una base y una sal. */
export function deriveSeed(base: number, salt: number): number {
  let s = (base ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0x85ebca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0xc2b2ae35) >>> 0;
  return (s ^ (s >>> 13)) >>> 0 || 0x2f6e2b1;
}
