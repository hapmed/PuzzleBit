import Phaser from "phaser";
import { COLORS } from "../config";
import levelCatalogJson from "../../../data/levels.json";
import { parseLevelCatalog, type LevelDef } from "../levels";
import { getNickname } from "../state";
import * as api from "../../api/client";
import { SFX_KEYS } from "../sfx";

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

    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.text(w / 2, h / 2 - 40, "PUZZLE", {
      fontFamily: '"Courier New", monospace',
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.add.text(w / 2, h / 2 + 20, "cargando…", {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#b0a6d9",
    }).setOrigin(0.5);

    // Sincroniza pendientes en cuanto arranca.
    if (navigator.onLine) {
      api.flushPending().catch(() => {
        /* error silencioso: la cola vuelve a encolarse */
      });
    }

    if (!getNickname()) {
      // El apodo se pide al terminar el primer nivel; no bloqueamos el arranque.
    }

    this.time.delayedCall(300, () => this.scene.start("Menu"));
  }

  private tryLoadDaily(): void {
    // Reto diario generado localmente a partir de la fecha (también offline).
    DAILY_LEVEL = null;
  }
}
