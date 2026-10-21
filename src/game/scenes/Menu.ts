import Phaser from "phaser";
import { COLORS } from "../config";
import { ensureMusic, playSfx } from "../sfx";

/** Escena de menú. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create(): void {
    ensureMusic(this);
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.9);

    // Título con sombra.
    const title = this.add
      .text(w / 2, h * 0.28, "PUZZLEBit", {
        fontFamily: '"Courier New", monospace',
        fontSize: "56px",
        color: "#ffd95e",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    title.setShadow(3, 3, "#14102b", 0, true, true);
    this.add
      .text(w / 2, h * 0.28 + 48, "match-3 pixel art", {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#b0a6d9",
      })
      .setOrigin(0.5);

    // Animación de piezas flotando.
    const deco = [1, 2, 3, 4, 5, 6];
    deco.forEach((t, i) => {
      const sprite = this.add.image(w * (0.2 + 0.1 * i), h * 0.45, `piece${t}`);
      sprite.setDisplaySize(48, 48);
      this.tweens.add({ targets: sprite, y: h * 0.45 - 14, duration: 900 + i * 60, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });

    this.button(w / 2, h * 0.62, "JUGAR", () => this.scene.start("LevelMap"), COLORS.accent);
    this.button(w / 2, h * 0.62 + 70, "ranking", () => this.scene.start("Ranking"), COLORS.panel);
    this.button(w / 2, h * 0.62 + 140, "reto diario", () => this.scene.start("Daily"), COLORS.panel);

    // Pieza decorativa girando.
    const gem = this.add.image(w / 2, h * 0.86, "piece1");
    gem.setDisplaySize(64, 64);
    this.tweens.add({ targets: gem, scale: { from: 1, to: 1.2 }, duration: 1400, yoyo: true, repeat: -1 });
  }

  private button(x: number, y: number, label: string, onClick: () => void, bg: number): void {
    const container = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 240, 54, bg).setStrokeStyle(3, 0x6a56ad);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add([rect, text]);
    container.setInteractive(new Phaser.Geom.Rectangle(-120, -27, 240, 54), Phaser.Geom.Rectangle.Contains);
    container.on("pointerdown", () => {
      playSfx(this, "click");
      this.tweens.add({ targets: container, scale: 0.94, duration: 70, yoyo: true, onComplete: onClick });
    });
  }
}
