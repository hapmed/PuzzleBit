import Phaser from "phaser";

const KEYS = ["click", "swap", "match", "cascade", "special", "win", "lose", "coin", "start", "vox2", "vox3", "vox4", "vox5"] as const;
export type SfxKey = (typeof KEYS)[number];
export const SFX_KEYS = KEYS;

/** Reproduce un efecto; silencioso si el sonido no está cargado. */
export function playSfx(scene: Phaser.Scene, key: SfxKey, rate = 1): void {
  if (!scene.sound) return;
  if (scene.cache.audio.exists(key)) {
    scene.sound.play(key, { rate });
  }
}

/**
 * Voz de "announcer" (estilo arcade) con la voz nativa del navegador.
 * Sin assets: usa speechSynthesis; calla la voz anterior para no solaparse.
 * Se puede silenciar con la clave de registro "voiceOff".
 */
export function announce(text: string, scene?: Phaser.Scene): void {
  if (scene?.registry.get("voiceOff")) return;
  if (!scene && typeof localStorage !== "undefined" && localStorage.getItem("pb.voiceoff") === "1") return;
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return;
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    // Grito grave y pausado, muy "presentador de arcade".
    utter.pitch = 0.5;
    utter.rate = 0.92;
    utter.volume = 0.9;
    const voice = synth
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("es") && /m(f|ale)/i.test(v.name)) ??
      synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
    if (voice) utter.voice = voice;
    synth.speak(utter);
  } catch {
    /* sin voz disponible: silencioso */
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
