import Phaser from "phaser";

const KEYS = ["click", "swap", "match", "cascade", "special", "win", "lose"] as const;
export type SfxKey = (typeof KEYS)[number];
export const SFX_KEYS = KEYS;

/** Reproduce un efecto; silencioso si el sonido no está cargado. */
export function playSfx(scene: Phaser.Scene, key: SfxKey, rate = 1): void {
  if (!scene.sound) return;
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, { rate });
  }
}

/** Música de fondo en loop (solo se lanza una vez por partida). */
export function ensureMusic(scene: Phaser.Scene): void {
  if (!scene.sound || scene.registry.get("musicPlaying")) return;
  if (!scene.cache.audio.exists("music")) return;
  const music = scene.sound.add("music", { loop: true, volume: 0.5 });
  music.play();
  scene.registry.set("musicPlaying", true);
}
