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
import { addCRTOverlays, screenPunch, victorySplash } from "../fx";
import { announce, playSfx } from "../sfx";
import {
  finalScoreWithMovesLeft,
  starsForScore,
} from "../engine/score";
import { recordDailyResult, recordLastPlayed, recordLevelResult, spendBooster, getAllProgress } from "../state";
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
    if (!this.isDaily) recordLastPlayed(this.levelId);
  }

  private resolveLevel(): LevelDef {
    const found = LEVELS.find((l) => l.id === this.levelId);
    if (found) return found;
    return this.levelId > LEVELS.length ? createEndlessLevel(this.levelId, LEVELS.length) : LEVELS[0];
  }

  create(): void {
    this.cameras.main.fadeIn(220, 0, 0, 0);
    const level = this.isDaily ? createDailyLevel() : this.resolveLevel();
    this.engine = new Engine(level);
    const w = this.scale.width;
    const h = this.scale.height;

    this.cameras.main.setBackgroundColor(COLORS.bg);
    const bgWall = this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.35);
    this.tweens.add({ targets: bgWall, x: bgWall.x - 10, duration: 5200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.add
      .text(w / 2, 12, this.isDaily ? "Reto diario" : `Nivel ${level.id} · ${level.name}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 0);

    // Layout del tablero: ocupa casi todo el ancho del teléfono.
    const topMargin = 110;
    const bottomMargin = 64;
    const sideMargin = 16;
    const availW = w - sideMargin * 2;
    const availH = h - topMargin - bottomMargin;
    const cellSize = Math.max(28, Math.min(Math.floor(availW / level.cols), Math.floor(availH / level.rows), 92));
    const originX = Math.floor((w - cellSize * level.cols) / 2);
    const originY = Math.floor(topMargin + (availH - cellSize * level.rows) / 2);

    this.boardView = new BoardView(this, this.engine, originX, originY, cellSize, (r) => this.onTurnEnd(r));

    this.hud = new Hud(this, this.engine, (kind) => this.onBooster(kind));
    this.hud.update(this.engine);
    addCRTOverlays(this);
    this.arcadeIntro();

    // Botón de pausa/salir (abajo a la derecha, junto a los boosters).
    const exit = this.add.container(w - 62, this.scale.height - 44);
    const bgExit = this.add.rectangle(0, 0, 74, 40, COLORS.panel).setStrokeStyle(2, COLORS.border);
    const exitLabel = this.add.text(0, 0, "salir", { fontFamily: '"Courier New", monospace', fontSize: "16px", color: "#fff" }).setOrigin(0.5);
    exit.add([bgExit, exitLabel]);
    exit.setSize(74, 40);
    exit.setInteractive({ useHandCursor: true });
    exit.on("pointerdown", () => this.scene.start("Menu"));

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

  /** Intro de gabinete: "¿LISTO?" → "¡YA!" con fanfarria (no bloquea el tablero). */
  private arcadeIntro(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const banner = this.add.text(w / 2, h * 0.42, "¿LISTO?", {
      fontFamily: '"Courier New", monospace',
      fontSize: "46px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(96).setStroke("#14102b", 8).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 180, ease: "Back.easeOut" });
    this.time.delayedCall(760, () => {
      banner.setText("¡YA!").setColor("#4dd6a0");
      playSfx(this, "start");
      this.tweens.add({ targets: banner, scale: 1.25, alpha: 0, duration: 360, delay: 120, onComplete: () => banner.destroy() });
    });
    // HI-SCOR chip arcade (mejor suma de progreso local).
    const map = getAllProgress();
    let best = 0;
    for (const p of Object.values(map)) best = Math.max(best, p.bestScore);
    this.add.text(w - 20, 46, `HI-SCOR ${best}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "13px",
      color: "#ff5fa2",
      fontStyle: "bold",
    }).setOrigin(1, 0);
  }

  private onBooster(kind: "hammer" | "shuffle" | "move"): void {    if (this.engine.finished || this.boardView.isBusy()) return;
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
    } else {
      this.maybeSpawnToasty();
    }
  }

  // ——— Popup arcade al estilo "toasty" (mascota original) ———
  private toastyCooldownUntil = 0;
  private toastyOpen?: Phaser.GameObjects.Container;

  /** Sorteo: cada turno finalizado puede invitar a la mascota al rincón. */
  private maybeSpawnToasty(): void {
    if (this.engine.finished || this.time.now < this.toastyCooldownUntil) return;
    if (Math.random() >= 0.16) return;
    this.toastyCooldownUntil = this.time.now + 9000;
    this.spawnToasty();
  }

  private spawnToasty(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const phrases = ["¡Doradito!", "¡Con queso!", "¡Fresco!", "¡Bien ahi!", "¡Rico rico!", "¡Nivelazo!"];
    const prize = 150 + 50 * (1 + Math.floor(Math.random() * 5)); // 200..600
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];

    const toast = this.add.container(w - 104, h - 132).setDepth(94);
    const face = this.add.image(-70, 0, "piece1").setDisplaySize(58, 58);
    const bubble = this.add.rectangle(36, 0, 150, 42, COLORS.panel).setStrokeStyle(2, 0xffd95e);
    const text = this.add.text(36, 0, phrase, {
      fontFamily: '"Courier New", monospace',
      fontSize: "16px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5);
    toast.add([bubble, text, face]);
    toast.setSize(240, 60);
    toast.setInteractive(new Phaser.Geom.Rectangle(-120, -30, 240, 60), Phaser.Geom.Rectangle.Contains);

    const collect = (): void => {
      toast.off("pointerdown", collect);
      this.engine.score += prize;
      this.hud.update(this.engine);
      playSfx(this, "special");
      announce("¡Bonus!", this);
      screenPunch(this, 0xffe14d, 0.8);
      const pop = this.add.text(toast.x, toast.y - 40, `+${prize} EXTRA`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "24px",
        color: "#4dd6a0",
        fontStyle: "bold",
      }).setOrigin(0.5).setDepth(96).setStroke("#14102b", 5);
      this.tweens.add({ targets: pop, y: "-=60", alpha: 0, duration: 640, onComplete: () => pop.destroy() });
      this.tweens.killTweensOf(toast);
      toast.destroy();
      this.toastyOpen = undefined;
    };
    toast.on("pointerdown", collect);

    // Aparece con rebote desde la derecha y coquetea mientras vive.
    toast.x = w + 130;
    this.tweens.add({ targets: toast, x: w - 104, duration: 260, ease: "Back.easeOut" });
    this.tweens.add({ targets: toast, angle: { from: -3, to: 3 }, duration: 160, yoyo: true, repeat: 6 });
    this.toastyOpen = toast;
    this.time.delayedCall(1750, () => {
      if (this.toastyOpen === toast) {
        this.tweens.add({ targets: toast, x: w + 130, alpha: 0, duration: 220, onComplete: () => toast.destroy() });
        this.toastyOpen = undefined;
      }
    });
  }

  /** Puntuación final con bonus de movimientos restantes y estrellas. */
  private finishVictory(): void {
    const finalScore = finalScoreWithMovesLeft(this.engine.score, this.engine.movesLeft);
    const stars = starsForScore(finalScore, this.engine.level.stars);
    victorySplash(this); // confeti multicolor + ondas al ganar
    this.showOverlay("¡WIN!", stars, finalScore, 500);
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
          this.scene.start("Menu");
        } else {
          this.scene.restart({ levelId: this.levelId + 1, daily: false });
        }
      });
      this.overlayButton(w / 2 - 120, buttonsY + 70, "menú", () => this.scene.start("Menu"));
      this.overlayButton(w / 2 + 120, buttonsY + 70, "reintentar", () => this.scene.restart());
    } else {
      this.overlayButton(w / 2, buttonsY, "reintentar", () => this.scene.restart());
      this.overlayButton(w / 2, buttonsY + 70, "menú", () => this.scene.start("Menu"));
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
