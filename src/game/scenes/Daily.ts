import Phaser from "phaser";
import { COLORS } from "../config";
import { getDailyState } from "../state";

/** Escena previa al reto diario: muestra estado y lanza la partida del día. */
export class DailyScene extends Phaser.Scene {
  constructor() {
    super("Daily");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.image(w / 2, h / 2, "bg").setDisplaySize(w, h).setAlpha(0.9);

    this.add
      .text(w / 2, h * 0.3, "Reto diario", {
        fontFamily: '"Courier New", monospace',
        fontSize: "44px",
        fontStyle: "bold",
        color: "#ffd95e",
      })
      .setOrigin(0.5);

    const state = getDailyState();
    const subtitle = state.done
      ? `Ya jugado hoy · mejor ${state.best} pts\n(puedes repetir la pieza sin premio extra)`
      : "Un nuevo puzzle cada día.\nCompite por el mejor puntaje.";
    this.add
      .text(w / 2, h * 0.45, subtitle, {
        fontFamily: '"Courier New", monospace',
        fontSize: "18px",
        color: "#b0a6d9",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    this.button(w / 2, h * 0.62, state.done ? "REPETIR" : "JUGAR", () => {
      this.scene.start("Game", { daily: true });
    }, COLORS.accent);
    this.button(w / 2, h * 0.62 + 70, "< volver", () => this.scene.start("Menu"), COLORS.panel);
  }

  private button(x: number, y: number, label: string, onClick: () => void, bg: number): void {
    const container = this.add.container(x, y);
    const rect = this.add.rectangle(0, 0, 240, 54, bg).setStrokeStyle(3, 0x6a56ad);
    const text = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: "20px",
      color: bg === COLORS.accent ? "#14102b" : "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add([rect, text]);
    container.setSize(240, 54);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => {
      this.tweens.add({ targets: container, scale: 0.94, duration: 70, yoyo: true, onComplete: onClick });
    });
  }
}
