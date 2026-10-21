import Phaser from "phaser";
import type { Engine } from "../engine/engine";
import type { Boosters } from "../state";
import { getBoosters } from "../state";

/** HUD del nivel: movimientos, puntuación, objetivos y boosters. */
export class Hud {
  private scene: Phaser.Scene;
  private movesText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private objLines: Phaser.GameObjects.Text[] = [];
  private boosterTexts: Partial<Record<keyof Boosters, Phaser.GameObjects.Text>> = {};
  private onBooster: (kind: keyof Boosters) => void;

  constructor(scene: Phaser.Scene, engine: Engine, onBooster: (kind: keyof Boosters) => void) {
    this.scene = scene;
    this.onBooster = onBooster;

    this.movesText = scene.add.text(20, 16, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    this.scoreText = scene.add.text(scene.scale.width - 20, 16, "", {
      fontFamily: '"Courier New", monospace',
      fontSize: "24px",
      color: "#ffd95e",
    });
    this.scoreText.setOrigin(1, 0);

    let y = 54;
    for (let i = 0; i < engine.objectives.length; i++) {
      const text = scene.add.text(20, y, "", {
        fontFamily: '"Courier New", monospace',
        fontSize: "16px",
        color: "#b0a6d9",
      });
      this.objLines.push(text);
      y += 20;
      void i;
    }

    // Botonera de boosters en la parte inferior.
    const b = getBoosters();
    this.addBoosterButton("hammer", "🔨", 20, scene.scale.height - 44, b.hammer);
    this.addBoosterButton("shuffle", "🔀", 120, scene.scale.height - 44, b.shuffle);
    this.addBoosterButton("move", "➕", 220, scene.scale.height - 44, b.move);
  }

  private addBoosterButton(key: keyof Boosters, icon: string, x: number, y: number, count: number): void {
    const btn = this.scene.add.container(x, y);
    const bg = this.scene.add.rectangle(0, 0, 92, 40, 0x3a2f63).setStrokeStyle(2, 0x6a56ad);
    const label = this.scene.add.text(14, 0, icon, { fontSize: "18px" }).setOrigin(0, 0.5);
    const num = this.scene.add.text(56, 0, String(count), {
      fontFamily: '"Courier New", monospace',
      fontSize: "18px",
      color: "#ffd95e",
    }).setOrigin(0, 0.5);
    btn.add([bg, label, num]);
    btn.setSize(92, 40);
    btn.setInteractive({ useHandCursor: true });
    // Zona de toque real (container con rectángulo interactivo).
    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.onBooster(key));
    this.boosterTexts[key] = num;
  }

  update(engine: Engine): void {
    this.movesText.setText(String(engine.movesLeft));
    this.scoreText.setText(String(engine.score));
    for (let i = 0; i < engine.objectives.length; i++) {
      const o = engine.objectives[i];
      const label = objectiveLabel(o.kind, o.ref);
      this.objLines[i]?.setText(`${label}: ${Math.min(o.progress, o.target)}/${o.target}`);
      if (this.objLines[i]) {
        const done = o.progress >= o.target;
        this.objLines[i].setColor(done ? "#4dd6a0" : "#b0a6d9");
      }
    }
    const b = getBoosters();
    this.boosterTexts.hammer?.setText(String(b.hammer));
    this.boosterTexts.shuffle?.setText(String(b.shuffle));
    this.boosterTexts.move?.setText(String(b.move));
  }
}

export function objectiveLabel(kind: string, ref?: number): string {  switch (kind) {
    case "score":
      return "Puntos";
    case "collect":
      return `Recolectar pieza ${ref ?? 1}`;
    case "clear":
      return "Jelly";
    case "ingredient":
      return "Ingredientes";
    default:
      return "Objetivo";
  }
}
