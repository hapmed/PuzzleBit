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
import { addCRTOverlays, addLevelAmbient, comboZoom, megaBreak, pixelRain, screenPunch, shockwave, victorySplash } from "../fx";
import { announce, ensureMusic, playSfx } from "../sfx";
import { funnyPhrase } from "../phrases";
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
  /** Turnos seguidos con cascada de 2+ (racha de combos). */
  private streak = 0;
  private streakText?: Phaser.GameObjects.Text;

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
    // Fondo vivo: tinte del nivel + estrellitas flotando.
    addLevelAmbient(this, bgWall, this.isDaily ? 77 : this.levelId);

    // Indicador de nivel SIEMPRE visible: gran "NIVEL X" + nombre debajo.
    this.add
      .text(w / 2, 8, this.isDaily ? "RETO DIARIO" : `NIVEL ${level.id}`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "22px",
        color: "#ffd95e",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0)
      .setStroke("#14102b", 4);
    this.add
      .text(w / 2, 36, this.isDaily ? "solo jugable hoy" : level.name, {
        fontFamily: '"Courier New", monospace',
        fontSize: "12px",
        color: "#b0a6d9",
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
    ensureMusic(this);
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

  /** Intro de gabinete: "¿LISTO?" → "¡YA!" → NIVEL X en grande, con fanfarria. */
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

    // El nivel actual, EN GRANDE, mientras el tablero cae.
    const isDaily = this.isDaily;
    const bigLabel = this.add.text(w / 2, h * 0.27, isDaily ? "RETO DIARIO" : `NIVEL ${this.levelId}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: isDaily ? "34px" : "52px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(96).setStroke("#14102b", 10).setScale(2.2).setAlpha(0);
    const subLabel = this.add.text(w / 2, h * 0.27 + 46, isDaily ? "¡solo jugable hoy!" : `«${this.resolveLevel().name}»`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "17px",
      color: "#b0a6d9",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(96).setAlpha(0);
    this.tweens.add({ targets: [bigLabel, subLabel], alpha: 1, delay: 880, duration: 200 });
    this.tweens.add({ targets: bigLabel, scale: 1, delay: 880, duration: 320, ease: "Back.easeOut" });
    this.time.delayedCall(3050, () => {
      this.tweens.add({ targets: [bigLabel, subLabel], alpha: 0, y: "-=26", duration: 380, onComplete: () => {
        bigLabel.destroy();
        subLabel.destroy();
      } });
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
    // Racha de combos: turnos seguidos con cascada de 2+.
    const casc = this.boardView.lastCascade;
    if (result.lost) {
      this.streak = 0;
      this.updateStreakChip();
    } else if (casc >= 2) {
      this.streak++;
      this.updateStreakChip();
      if (this.streak >= 2) this.showStreak(this.streak);
    } else {
      this.streak = 0;
      this.updateStreakChip();
    }
    if (result.won) {
      this.finishVictory();
    } else if (result.lost) {
      this.finishDefeat();
    } else {
      this.maybeSpawnToasty();
    }
  }

  // ——— Racha de combos ———
  private showStreak(n: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.updateStreakChip();
    const tiers = [
      { msg: "¡RACHA!", tint: 0xff9a3d },
      { msg: "¡EN LLAMAS!", tint: 0xff5fa2 },
      { msg: "¡Sobrecarga de combos!", tint: 0xb06bff },
      { msg: "¡¡INMENSO!!", tint: 0xffffff },
    ];
    const tier = tiers[Math.min(n - 2, tiers.length - 1)];
    screenPunch(this, tier.tint, 0.55 + Math.min(n * 0.08, 0.5));
    comboZoom(this, 0.8 + Math.min(n * 0.18, 1.2)); // la racha aprieta el zoom
    playSfx(this, "cascade", 1 + Math.min(n, 10) * 0.07); // cada racha suena más agudo
    if (n >= 3) {
      pixelRain(this, tier.tint, 24);
      announce(`¡Racha de ${n} combos!`, this);
    }
    if (n >= 5) {
      // Espectáculo total: mega-rompe central + doble onda expansiva + aguacero blanco.
      megaBreak(this, w / 2, h * 0.31, tier.tint);
      shockwave(this, w * 0.3, h * 0.5, tier.tint, 1.3);
      shockwave(this, w * 0.7, h * 0.5, tier.tint, 1.3);
      pixelRain(this, 0xffffff, 40);
    }
    const banner = this.add.text(w / 2, h * 0.31, `${tier.msg} x${n}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "30px",
      color: "#ffd95e",
      fontStyle: "bold",
    }).setOrigin(0.5).setDepth(96).setStroke("#14102b", 8).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 200, ease: "Back.easeOut" });
    this.tweens.add({ targets: banner, alpha: 0, y: "-=34", duration: 340, delay: 900, onComplete: () => banner.destroy() });
  }

  /** Chip persistente con la racha activa (bajo el HI-SCOR). */
  private updateStreakChip(): void {
    const w = this.scale.width;
    if (!this.streakText) {
      this.streakText = this.add.text(w - 20, 62, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "15px",
        color: "#ffd95e",
        fontStyle: "bold",
      }).setOrigin(1, 0).setDepth(80);
    }
    const s = this.streak;
    this.streakText.setText(s >= 2 ? `RACHA x${s} 🔥` : "");
    if (s >= 2) {
      this.streakText.setScale(1.25);
      this.tweens.add({ targets: this.streakText, scale: 1, duration: 180, ease: "Back.easeOut" });
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
    playSfx(this, "win");
    this.showOverlay("¡WIN!", stars, finalScore, 500, false, funnyPhrase(true));
  }

  private finishDefeat(): void {
    const stars = 0;
    const finalScore = this.engine.score;
    playSfx(this, "lose");
    this.showOverlay("GAME OVER", stars, finalScore, 500, true, funnyPhrase(false));
  }

  private showOverlay(title: string, stars: number, finalScore: number, _delay: number, defeat = false, phrase = ""): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, 0x14102b, 0.82).setDepth(90);

    const panel = this.add
      .text(w / 2, h * 0.5 - 168, title, {
        fontFamily: '"Courier New", monospace',
        fontSize: "46px",
        color: defeat ? "#ff5fa2" : "#ffd95e",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(91);
    panel.setScale(0.6);
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: "Back.easeOut" });

    // Estrellas.
    for (let i = 0; i < 3; i++) {
      const img = this.add.image(w / 2 + (i - 1) * 70, h * 0.5 - 96, "star").setDepth(91);
      img.setDisplaySize(56, 56);
      img.setAlpha(i < stars ? 0 : 0.15);
      if (i < stars) {
        this.tweens.add({ targets: img, alpha: 1, scale: { from: img.scale * 2, to: img.scale }, delay: 250 + i * 220, duration: 300, bounce: 0.2 });
      }
    }

    const scoreText = this.add
      .text(w / 2, h * 0.5 - 14, `${finalScore} puntos`, {
        fontFamily: '"Courier New", monospace',
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(91);

    void scoreText;

    // Frase hilariante aleatoria (el anunciador la lee en voz alta).
    if (phrase) {
      const quote = this.add
        .text(w / 2, h * 0.5 + 44, `“${phrase}”`, {
          fontFamily: '"Courier New", monospace',
          fontSize: "19px",
          color: defeat ? "#b0a6d9" : "#4dd6a0",
          wordWrap: { width: w - 60, useAdvancedWrap: true },
          align: "center",
        })
        .setOrigin(0.5, 0)
        .setDepth(91)
        .setAlpha(0);
      this.tweens.add({ targets: quote, alpha: 1, duration: 250, delay: 420 });
      this.time.delayedCall(650, () => announce(phrase, this));
      // Tiemblito gracioso mientras la frase levita.
      this.tweens.add({ targets: quote, angle: { from: -0.8, to: 0.8 }, duration: 90, yoyo: true, repeat: 10 });
    }

    // Guarda el resultado y sincroniza (progreso/estrellas/score).
    this.persistResult(defeat ? 0 : stars, finalScore, defeat);

    const buttonsY = h * 0.5 + 150;
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
      this.overlayButton(w / 2 - 120, buttonsY + 70, "menú", () => this.scene.start("Menu"));
      this.overlayButton(w / 2 + 120, buttonsY + 70, "¿reventar?", () => {
        this.toast("¡Eso no se puede reventar!");
      });
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
