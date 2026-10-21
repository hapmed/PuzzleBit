import Phaser from "phaser";
import { LEVELS } from "./Preload";
import { getAllProgress, isEndlessUnlocked, maxEndlessLevel, maxPlayableLevel } from "../state";
import { COLORS } from "../config";

/** Mapa de niveles: nodos con estrellas y desbloqueo secuencial. */
export class LevelMapScene extends Phaser.Scene {
  constructor() {
    super("LevelMap");
  }

  create(): void {
    const w = this.scale.width;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.text(w / 2, 60, "Niveles", {
      fontFamily: '"Courier New", monospace',
      fontSize: "40px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    const unlocked = maxPlayableLevel(LEVELS.length);
    const progress = getAllProgress();
    const perRow = 6;
    const step = 122;
    const startX = w / 2 - ((perRow - 1) * step) / 2;
    const startY = 150;
    const rowStep = 112;
    const totalRows = Math.ceil(LEVELS.length / perRow);
    let x = startX;
    let y = startY;

    LEVELS.forEach((lvl, idx) => {
      const node = idx + 1;
      const p = progress[String(node)];
      const isNext = node === unlocked;
      const playable = node <= unlocked;
      const rowIdx = Math.floor(idx / perRow);
      const col = idx % perRow;
      // Última fila incompleta: centrar los nodos que quedan.
      const inRow = rowIdx < totalRows - 1 ? perRow : LEVELS.length - (totalRows - 1) * perRow;
      const rowOffset = ((perRow - inRow) / 2) * step;
      x = startX + rowOffset + col * step;
      y = startY + rowIdx * rowStep;
      const container = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, 96, 96, playable ? COLORS.panel : 0x241d3f).setStrokeStyle(
        3,
        isNext ? COLORS.accent : playable ? COLORS.border : 0x3a2f63,
      );
      container.add(bg);
      const label = this.add.text(0, -10, String(node), {
        fontFamily: '"Courier New", monospace',
        fontSize: "30px",
        color: playable ? "#ffffff" : "#6a56ad",
        fontStyle: "bold",
      }).setOrigin(0.5);
      container.add(label);
      const name = this.add.text(0, 20, lvl.name.slice(0, 11), {
        fontFamily: '"Courier New", monospace',
        fontSize: "11px",
        color: playable ? "#b0a6d9" : "#3f345f",
      }).setOrigin(0.5);
      container.add(name);

      if (playable) {
        container.setSize(96, 96);
        container.setInteractive({ useHandCursor: true });
        container.on("pointerdown", () => {
          this.scene.start("Game", { levelId: node });
        });
        if (isNext) {
          this.tweens.add({ targets: container, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1 });
        }
      } else {
        const lock = this.add.image(0, 38, "overlay-crate");
        lock.setDisplaySize(26, 26);
        container.add(lock);
      }

      // Estrellas obtenidas (dentro del nodo).
      const stars = p?.stars ?? 0;
      for (let s = 0; s < 3; s++) {
        const img = this.add.image(-24 + s * 24, 38, "star");
        img.setDisplaySize(22, 22);
        img.setAlpha(s < stars ? 1 : 0.15);
        container.add(img);
      }
    });

    this.endlessNode(startY + (totalRows - 1) * rowStep + rowStep + 6);
    // Botón atrás.
    this.backButton();
  }

  /** Nodo del modo infinito: siempre avance a tu propio ritmo. */
  private endlessNode(y: number): void {
    const w = this.scale.width;
    const total = LEVELS.length;
    if (!isEndlessUnlocked(total)) return;
    const deepest = maxEndlessLevel(total);
    const x = w / 2;
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 220, 72, COLORS.panel).setStrokeStyle(3, COLORS.accent);
    container.add(bg);
    const label = this.add.text(0, -14, `∞ nivel ${deepest}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add(label);
    const completed = deepest - 1 - total;
    const sub = this.add.text(0, 16, completed > 0 ? `${completed} superados` : "primera vez", {
      fontFamily: '"Courier New", monospace',
      fontSize: "12px",
      color: "#b0a6d9",
    }).setOrigin(0.5);
    container.add(sub);
    container.setSize(220, 72);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => {
      this.scene.start("Game", { levelId: deepest });
    });
    this.tweens.add({ targets: container, scale: { from: 1, to: 1.04 }, duration: 700, yoyo: true, repeat: -1 });
  }

  private backButton(): void {
    const container = this.add.container(70, this.scale.height - 50);
    const bg = this.add.rectangle(0, 0, 120, 44, COLORS.panel).setStrokeStyle(2, COLORS.border);
    const label = this.add.text(0, 0, "< menú", {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#ffffff",
    }).setOrigin(0.5);
    container.add([bg, label]);
    container.setSize(120, 44);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => this.scene.start("Menu"));
  }
}
