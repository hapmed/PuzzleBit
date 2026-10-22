import Phaser from "phaser";
import { COLORS } from "../config";
import levelCatalogJson from "../../../data/levels.json";
import { parseLevelCatalog, type LevelDef } from "../levels";
import { ensureNickname, getNickname, isCampaignCompleted, isTutorialDone, maxEndlessLevel, maxPlayableLevel, resumeLevel } from "../state";
import { addCRTOverlays } from "../fx";
import { playSfx, SFX_KEYS, bindAudioUnlock } from "../sfx";
import * as api from "../../api/client";

export let LEVELS: LevelDef[] = [];
export let DAILY_LEVEL: LevelDef | null = null;

/** Precarga: catálogo de niveles + attempt online + nickname. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    for (const key of SFX_KEYS) this.load.audio(key, `audio/${key}.wav`);
    this.load.audio("music", "audio/music.wav");
  }

  create(): void {
    // El catálogo va empaquetado en el build (offline-first).
    LEVELS = parseLevelCatalog(levelCatalogJson);
    this.tryLoadDaily();
    // El audio móvil queda desbloqueado con el primer gesto en cualquier parte.
    bindAudioUnlock(this);

    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    addCRTOverlays(this);

    // Pantalla de gabinete: título + moneda cayendo antes de arrancar.
    this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.35);
    this.add.text(w / 2, h * 0.3, "PUZZLE", {
      fontFamily: '"Courier New", monospace',
      fontSize: "52px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const blink = this.add.text(w / 2, h * 0.62, "INSERT COIN", {
      fontFamily: '"Courier New", monospace',
      fontSize: "30px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.tweens.add({ targets: blink, alpha: { from: 1, to: 0.15 }, duration: 340, yoyo: true, repeat: -1 });

    // Apodo gracioso automático en la primera visita.
    const fresh = ensureNickname();
    if (fresh) {
      this.add.text(w / 2, h * 0.78, `jugando como: ${getNickname()}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#4dd6a0",
        fontStyle: "bold",
      }).setOrigin(0.5);
    }

    const coinAlign = h * 0.62 + 40;
    const coinTxt = this.add.text(w / 2 - 44, coinAlign - 90, "🪙", { fontSize: "30px" }).setOrigin(0.5).setVisible(false);
    this.time.delayedCall(420, () => {
      coinTxt.setVisible(true);
      this.tweens.add({
        targets: coinTxt,
        y: coinAlign,
        scale: { from: 1.4, to: 1 },
        duration: 320,
        ease: "Bounce.easeIn",
        onComplete: () => playSfx(this, "coin"),
      });
    });

    // Sincroniza pendientes en cuanto arranca.
    if (navigator.onLine) {
      api.flushPending().catch(() => {
        /* error silencioso: la cola vuelve a encolarse */
      });
    }

    // Entra directo a jugar: último nivel jugado (o el pendiente la 1ª vez).
    // Tap = saltar el intro del gabinete (impatient arcade player).
    let started = false;
    const enterGame = (): void => {
      if (started) return;
      started = true;
      const total = LEVELS.length;
      const unlocked = maxPlayableLevel(total);
      const fallback = isCampaignCompleted(total) ? maxEndlessLevel(total) : unlocked;
      const next = resumeLevel(fallback);
      // Primera visita: briefing de gabinete (cómo se juega y las reglas).
      if (!isTutorialDone()) {
        this.scene.start("Tutorial", { levelId: next });
        return;
      }
      this.scene.start("Game", { levelId: next });
    };
    this.input.once("pointerdown", enterGame);
    this.time.delayedCall(1100, enterGame);
  }

  private tryLoadDaily(): void {
    // Reto diario generado localmente a partir de la fecha (también offline).
    DAILY_LEVEL = null;
  }
}
