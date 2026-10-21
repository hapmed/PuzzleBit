import Phaser from "phaser";
import { COLORS } from "../config";
import { addCRTOverlays } from "../fx";
import { ensureMusic, playSfx } from "../sfx";
import {
  getNickname,
  isCampaignCompleted,
  maxEndlessLevel,
  maxPlayableLevel,
  randomFunnyNickname,
  resumeLevel,
  setNickname,
} from "../state";
import { LEVELS } from "./Preload";

/** Nivel de reanudación (último jugado o el pendiente). */
function resumePlayableLevel(): number {
  const total = LEVELS.length;
  return resumeLevel(isCampaignCompleted(total) ? maxEndlessLevel(total) : maxPlayableLevel(total));
}

/** Escena de menú. */
export class MenuScene extends Phaser.Scene {

  constructor() {
    super("Menu");
  }

  create(): void {
    ensureMusic(this);
    this.cameras.main.fadeIn(220, 0, 0, 0);
    addCRTOverlays(this, 0.08);
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.9);

    // Título con sombra y rebote juguetón.
    const title = this.add
      .text(w / 2, h * 0.24, "PUZZLEBit", {
        fontFamily: '"Courier New", monospace',
        fontSize: "56px",
        color: "#ffd95e",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    title.setShadow(3, 3, "#14102b", 0, true, true);
    this.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.05 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.add
      .text(w / 2, h * 0.24 + 46, "match-3 pixel art", {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#b0a6d9",
      })
      .setOrigin(0.5);

    // Animación de piezas flotando (arco con parallax suave).
    const deco = [1, 3, 5, 6, 4, 2];
    deco.forEach((t, i) => {
      const sprite = this.add.image(w * (0.2 + 0.1 * i), h * 0.36, `piece${t}`);
      sprite.setDisplaySize(44, 44);
      this.tweens.add({
        targets: sprite,
        y: h * 0.34,
        duration: 700 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: i * 110,
      });
    });

    // Piezas tasca: banner del apodo + dado para cambiarlo.
    this.buildNicknameBanner(w, h);

    // Botones: JUGAR reanuda el último nivel jugado; resto en fila compacta.
    this.bigButton(w / 2, h * 0.6, "▶ JUGAR", () => this.scene.start("Game", { levelId: resumePlayableLevel() }), COLORS.accent);
    this.smallButton(w * 0.5, h * 0.6 + 78, "ranking", () => this.scene.start("Ranking"));
    this.smallButton(w * 0.74, h * 0.6 + 78, "diario", () => this.scene.start("Daily"));
  }

  private buildNicknameBanner(w: number, h: number): void {
    const nick = getNickname();
    const y = h * 0.48;
    const banner = this.add.container(w / 2, y);
    const bg = this.add.rectangle(0, 0, 320, 44, COLORS.panel).setStrokeStyle(2, 0x6a56ad);
    const label = this.add.text(0, 0, `😊 ${nick}`, {
      fontFamily: '"Courier New", monospace',
      fontSize: "20px",
      color: "#ffffff",
    }).setOrigin(0.5);
    banner.add([bg, label]);
    banner.setInteractive(new Phaser.Geom.Rectangle(-160, -22, 320, 44), Phaser.Geom.Rectangle.Contains);
    // Reroll inmediato del apodo (misma interacción => feedback vivo).
    banner.on("pointerdown", () => {
      playSfx(this, "click");
      const newNick = randomFunnyNickname();
      setNickname(newNick);
      this.tweens.add({
        targets: banner,
        scale: { from: 1, to: 0.92 },
        duration: 80,
        yoyo: true,
        onYoyo: () => label.setText(`😊 ${newNick}`),
      });
    });
    this.tweens.add({ targets: banner, scale: { from: 0.8, to: 1 }, duration: 260, ease: "Back.easeOut" });
  }

  private bigButton(x: number, y: number, label: string, onClick: () => void, bg: number): void {
    const container = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 280, 62, bg).setStrokeStyle(3, 0xffd95e, 0.6);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add([rect, text]);
    container.setSize(280, 62);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => {
      playSfx(this, "click");
      this.tweens.add({
        targets: container,
        scale: 0.94,
        duration: 70,
        yoyo: true,
        onComplete: () => {
          this.cameras.main.fadeOut(140, 0, 0, 0);
          this.time.delayedCall(150, () => {
            onClick();
            this.cameras.main.fadeIn(220, 0, 0, 0);
          });
        },
      });
    });
    this.tweens.add({ targets: container, scale: { from: 0.96, to: 1.02 }, duration: 1100, yoyo: true, repeat: -1 });
  }

  private smallButton(x: number, y: number, label: string, onClick: () => void): void {
    const container = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 150, 46, COLORS.panel).setStrokeStyle(2, 0x6a56ad);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#ffffff",
    }).setOrigin(0.5);
    container.add([rect, text]);
    container.setSize(150, 46);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => {
      playSfx(this, "click");
      this.tweens.add({
        targets: container,
        scale: 0.93,
        duration: 70,
        yoyo: true,
        onComplete: () => {
          this.cameras.main.fadeOut(140, 0, 0, 0);
          this.time.delayedCall(150, () => {
            onClick();
            this.cameras.main.fadeIn(220, 0, 0, 0);
          });
        },
      });
    });
  }
}
