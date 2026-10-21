import Phaser from "phaser";
import { createGameTextures } from "../art";
import { COLORS } from "../config";

/** Escena inicial: genera textoos/texturas y salta al preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.game.canvas.classList.add("pixelated");
    this.cameras.main.setBackgroundColor(COLORS.bg);
    createGameTextures(this);
    this.scene.start("Preload");
  }
}
