import Phaser from "phaser";
import { BoardView } from "../objects/BoardView";
import { Hud } from "../objects/Hud";
import { Engine } from "../engine/engine";
import type { TurnResult } from "../engine/engine";
import { LEVELS } from "./Preload";
import { createDailyLevel } from "../daily";
import { createEndlessLevel } from "../endless";
import type { LevelDef } from "../levels";
import { COLORS } from "../config";
import {
  finalScoreWithMovesLeft,
  starsForScore,
} from "../engine/score";
import { recordDailyResult, recordLevelResult, spendBooster } from "../state";
import { postProgress, postScore } from "../../api/client";

/** Escena de juego: motor + vista + HUD + boosters. */
export class GameScene extends Phaser.Scene {
  private engine!: Engine;
  private boardView!: BoardView;
  private hud!: Hud;
  private levelId = 1;
  private isDaily = false;

  constructor() {
    super("Game");
  }

  init(data: { levelId?: number; daily?: boolean }): void {
    this.isDaily = !!data.daily;
    this.levelId = data.levelId ?? 1;
    if (this.levelId < 1) this.levelId = 1;
  }

  private resolveLevel(): LevelDef {
    const found = LEVELS.find((l) => l.id === this.levelId);
    if (found) return found;
    return this.levelId > LEVELS.length ? createEndlessLevel(this.levelId, LEVELS.length) : LEVELS[0];
  }

  create(): void {
    const level = this.isDaily ? createDailyLevel() : this.resolveLevel();
    this.engine = new Engine(level);
    const w = this.scale.width;
    const h = this.scale.height;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.35);

    this.add
      .text(w / 2, 12, this.isDaily ? "Reto diario" : `Nivel ${level.id} · ${level.name}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    // Layout del tablero: caben filas y columnas en el área disponible.
    const topMargin = 110;
    const bottomMargin = 70;
    const availW = w - 32;
    const availH = h - topMargin - bottomMargin;
    const cellSize = Math.max(28, Math.min(Math.floor(availW / level.cols), Math.floor(availH / level.rows), 72));
    const originX = Math.floor((w - cellSize * level.cols) / 2);
    const originY = Math.floor(topMargin + (availH - cellSize * level.rows) / 2);

    this.boardView = new BoardView(this, this.engine, originX, originY, cellSize, (r) => this.onTurnEnd(r));

    this.hud = new Hud(this, this.engine, (kind) => this.onBooster(kind));
    this.hud.update(this.engine);

    // Botón de pausa/salir.
    const exit = this.add.container(w - 56, 76);
    const bg = this.add.rectangle(0, 0, 74, 40, COLORS.panel).setStrokeStyle(2, COLORS.border);
    const label = this.add.text(0, 0, "salir", { fontFamily: '"Courier New", monospace', fontSize: "16px", color: "#fff" }).setOrigin(0.5);
    exit.add([bg, label]);
    exit.setSize(74, 40);
    exit.setInteractive({ useHandCursor: true });
    exit.on("pointerdown", () => this.scene.start("LevelMap"));

    if (this.isDaily) this.renderDailyStamp();
  }

  private renderDailyStamp(): void {
    const stamp = this.add.text(this.scale.width - 20, this.scale.height - 20, "reto", {
      fontFamily: '"Courier New", monospace',
      fontSize: "14px",
      color: "#6a56ad",
    }).setOrigin(1, 1);
    stamp.setAlpha(0.7);
  }

  private onBooster(kind: "hammer" | "shuffle" | "move"): void {
    if (this.engine.finished || this.boardView.isBusy()) return;
    if (!spendBooster(kind)) {
      this.toast("¡Sin cargas!");
      return;
    }
    if (kind === "hammer") {
      this.boardView.setHammerMode(true);
      this.toast("Toca la pieza al romper");
    } else if (kind === "shuffle") {
      void this.boardView.runTurn(() => this.engine.useShuffle());
    } else {
      this.engine.addMove();
      this.hud.update(this.engine);
    }
    this.hud.update(this.engine);
  }

  private toast(msg: string): void {
    const text = this.add
      .text(this.scale.width / 2, 140, msg, {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#ffd95e",
        backgroundColor: "#14102bcc",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 30, delay: 900, duration: 400, onComplete: () => text.destroy() });
  }

  private onTurnEnd(result: TurnResult): void {
    this.hud.update(this.engine);
    if (result.won) {
      this.finishVictory();
    } else if (result.lost) {
      this.finishDefeat();
    }
  }

  /** Puntuación final con bonus de movimientos restantes y estrellas. */
  private finishVictory(): void {
    const finalScore = finalScoreWithMovesLeft(this.engine.score, this.engine.movesLeft);
    const stars = starsForScore(finalScore, this.engine.level.stars);
    const delay = 500;
    this.showOverlay("¡WIN!", stars, finalScore, delay);
  }

  private finishDefeat(): void {
    const stars = 0;
    const finalScore = this.engine.score;
    this.showOverlay("Ups…", stars, finalScore, 500, true);
  }

  private showOverlay(title: string, stars: number, finalScore: number, _delay: number, defeat = false): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x14102b, 0.78).setDepth(90);

    const panel = this.add
      .text(w / 2, h / 2 - 120, title, {
        fontFamily: '"Courier New", monospace',
        fontSize: "44px",
        color: defeat ? "#ff5fa2" : "#ffd95e",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(91);
    panel.setScale(0.6);
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: "Back.easeOut" });

    // Estrellas.
    for (let i = 0; i < 3; i++) {
      const img = this.add.image(w / 2 + (i - 1) * 70, h / 2 - 30, "star").setDepth(91);
      img.setDisplaySize(56, 56);
      img.setAlpha(i < stars ? 0 : 0.15);
      if (i < stars) {
        this.tweens.add({ targets: img, alpha: 1, scale: { from: img.scale * 2, to: img.scale }, delay: 250 + i * 220, duration: 300, bounce: 0.2 });
      }
    }

    const scoreText = this.add
      .text(w / 2, h / 2 + 40, `${finalScore} puntos`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(91);

    void scoreText;

    // Guarda el resultado y sincroniza (progreso/estrellas/score).
    this.persistResult(defeat ? 0 : stars, finalScore, defeat);

    const buttonsY = h / 2 + 120;
    if (!defeat) {
      this.overlayButton(w / 2, buttonsY, "siguiente nivel", () => {
        if (this.isDaily) {
          this.scene.start("LevelMap");
        } else {
          this.scene.restart({ levelId: this.levelId + 1, daily: false });
        }
      });
      this.overlayButton(w / 2 - 120, buttonsY + 70, "mapa", () => this.scene.start("LevelMap"));
      this.overlayButton(w / 2 + 120, buttonsY + 70, "reintentar", () => this.scene.restart());
    } else {
      this.overlayButton(w / 2, buttonsY, "reintentar", () => this.scene.restart());
      this.overlayButton(w / 2, buttonsY + 70, "mapa", () => this.scene.start("LevelMap"));
    }
  }

  private persistResult(stars: number, finalScore: number, defeat: boolean): void {
    if (this.isDaily) {
      if (!defeat) {
        recordDailyResult(finalScore, stars);
      }
      // El reto diario no se sincroniza con el ranking (nivel no está en el catálogo).
      return;
    }
    const maxStars = defeat ? 0 : stars;
    const prog = recordLevelResult(this.levelId, finalScore, maxStars);
    void postProgress({ level_id: this.levelId, stars: prog.stars, best_score: prog.bestScore, completed: true });
    void postScore({ level_id: this.levelId, score: finalScore, moves_left: this.engine.movesLeft });
  }

  private overlayButton(x: number, y: number, label: string, onClick: () => void): void {
    const container = this.add.container(x, y).setDepth(92);
    const bg = this.add.rectangle(0, 0, 220, 50, COLORS.panel).setStrokeStyle(2, COLORS.border);
    const text = this.add.text(0, 0, label, { fontFamily: '"Courier New", monospace', fontSize: "18px", color: "#ffffff" }).setOrigin(0.5);
    container.add([bg, text]);
    container.setSize(220, 50);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => onClick());
  }
}
