import Phaser from "phaser";
import { COLORS } from "../config";
import { addCRTOverlays } from "../fx";
import { LEVELS } from "./Preload";
import { ensureNickname, fetchRanking, pendingSyncCount, type LevelRanking } from "../../api/client";
import { getAllProgress } from "../state";

/** Escena de ranking: global y por nivel (requiere backend). */
export class RankingScene extends Phaser.Scene {
  constructor() {
    super("Ranking");
  }

  create(): void {
    this.cameras.main.fadeIn(220, 0, 0, 0);
    ensureNickname();
    addCRTOverlays(this, 0.08);
    const w = this.scale.width;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.text(w / 2, 56, "Ranking", {
      fontFamily: '"Courier New", monospace',
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const contentY = 150;
    const tabsY = 100;
    void contentY;
    void tabsY;
    this.showGlobal();

    this.backButton();
  }

  /** Ranking global con botones para cambiar de nivel. */
  private showGlobal(): void {
    const w = this.scale.width;
    const listY = 150;
    const status = this.add
      .text(w / 2, listY, "Cargando ranking…", { fontFamily: '"Courier New", monospace', fontSize: "18px", color: "#b0a6d9" })
      .setOrigin(0.5);

    fetchRanking().then((ranking) => {
      const container = this.add.container(w / 2, listY + 30);
      if (ranking == null) {
        const pend = pendingSyncCount();
        status.setText(pend > 0 ? `Sin conexión · ${pend} por sincronizar` : "Sin conexión");
        this.showLocalProgress(container);
        return;
      }
      status.destroy();
      const title = this.add.text(0, 0, "Top global", {
        fontFamily: '"Courier New", monospace',
        fontSize: "20px",
        color: "#ffd95e",
      }).setOrigin(0.5, 0);
      container.add(title);
      ranking.total.slice(0, 10).forEach((entry, idx) => {
        const row = this.add.text(0, 44 + idx * 34, `${idx + 1}. ${entry.player} — ${entry.score}`, {
          fontFamily: '"Courier New", monospace',
          fontSize: "18px",
          color: idx === 0 ? "#ffd95e" : "#ffffff",
          fontStyle: idx === 0 ? "bold" : "normal",
        }).setOrigin(0.5, 0);
        container.add(row);
      });
      if (ranking.total.length === 0) {
        container.add(this.add.text(0, 60, "Aún no hay puntuaciones", { fontFamily: '"Courier New", monospace', fontSize: "16px", color: "#b0a6d9" }).setOrigin(0.5, 0));
      }
    });
  }

  /** Sin conexión: muestra el progreso local del jugador. */
  private showLocalProgress(container: Phaser.GameObjects.Container): void {
    const progress = getAllProgress();
    const rows: string[] = [];
    for (const [key, value] of Object.entries(progress)) {
      rows.push(`N${key} — ${value.bestScore} pts (${value.stars}★)`);
    }
    if (rows.length === 0) {
      container.add(this.add.text(0, 40, "Progreso local vacío", { fontFamily: '"Courier New", monospace', fontSize: "16px", color: "#b0a6d9" }).setOrigin(0.5));
      return;
    }
    const listing = this.add.text(0, 46, rows.slice(0, 10).join("\n"), {
      fontFamily: '"Courier New", monospace',
      fontSize: "17px",
      color: "#ffffff",
      lineSpacing: 8,
    }).setOrigin(0.5, 0);
    container.add(listing);
  }

  private backButton(): void {
    void LEVELS;
    const container = this.add.container(70, this.scale.height - 50);
    const bg = this.add.rectangle(0, 0, 120, 44, COLORS.panel).setStrokeStyle(2, COLORS.border);
    const label = this.add.text(0, 0, "< menú", { fontFamily: '"Courier New", monospace', fontSize: "18px", color: "#ffffff" }).setOrigin(0.5);
    container.add([bg, label]);
    container.setSize(120, 44);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => this.scene.start("Menu"));
  }
}

export type { LevelRanking };
