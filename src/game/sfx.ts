import Phaser from "phaser";

const KEYS = ["click", "swap", "match", "cascade", "special", "win", "lose", "coin", "start", "vox2", "vox3", "vox4", "vox5"] as const;
export type SfxKey = (typeof KEYS)[number];
export const SFX_KEYS = KEYS;

/** Contexto WebAudio del gestor de sonido (si lo hay). */
function audioContext(scene: Phaser.Scene): AudioContext | undefined {
  return (scene.sound as unknown as { context?: AudioContext } | undefined)?.context;
}

/** Desbloquea/reanuda el audio móvil: los navegadores lo suspenden hasta el primer gesto. */
function ensureAudioContext(scene: Phaser.Scene): void {
  const sound = scene.sound;
  if (!sound) return;
  try {
    if (sound.locked) sound.unlock();
    const ctx = audioContext(scene);
    if (ctx && ctx.state === "suspended") void ctx.resume();
  } catch {
    /* sin WebAudio disponible: silencioso */
  }
}

/** Escucha global (una sola vez por sesión): reanuda el audio con el primer gesto
 *  y al volver de segundo plano (iOS/Android suspenden el contexto). */
export function bindAudioUnlock(scene: Phaser.Scene): void {
  if (scene.registry.get("audioUnlocked")) return;
  scene.registry.set("audioUnlocked", true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const sound = scene.sound;
    if (!sound) return;
    try {
      const ctx = audioContext(scene);
      if (ctx && ctx.state === "suspended") void ctx.resume();
    } catch {
      /* noop */
    }
  }, { passive: true });
  scene.input.on("pointerdown", () => ensureAudioContext(scene));
}

/** Reproduce un efecto; silencioso si el sonido no está cargado. */
export function playSfx(scene: Phaser.Scene, key: SfxKey, rate = 1): void {
  const sound = scene.sound;
  if (!sound) return;
  ensureAudioContext(scene);
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

/** Música de fondo en loop; reaparece si el contexto volvió a suspenderse. */
export function ensureMusic(scene: Phaser.Scene): void {
  const sound = scene.sound;
  if (!sound || !scene.cache.audio.exists("music")) return;
  if (scene.registry.get("musicPlaying")) return;
  ensureAudioContext(scene);
  const music = sound.add("music", { loop: true, volume: 0.5 });
  music.play();
  scene.registry.set("musicPlaying", true);
}
