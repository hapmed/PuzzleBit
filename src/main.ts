import Phaser from "phaser";
import { BootScene } from "./game/scenes/Boot";
import { PreloadScene } from "./game/scenes/Preload";
import { MenuScene } from "./game/scenes/Menu";
import { GameScene } from "./game/scenes/Game";
import { RankingScene } from "./game/scenes/Ranking";
import { DailyScene } from "./game/scenes/Daily";
import { TutorialScene } from "./game/scenes/Tutorial";
import { H, W } from "./game/config";

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* la PWA sigue funcionando online sin SW */
  });
}

registerServiceWorker();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: W,
  height: H,
  backgroundColor: "#14102b",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  dom: { createContainer: false },
  scene: [BootScene, PreloadScene, TutorialScene, MenuScene, GameScene, RankingScene, DailyScene],
});

// Handle para depuración/automatización (no se usa en producción).
(window as unknown as { __puzzlebit?: Phaser.Game }).__puzzlebit = game;

const splash = document.getElementById("splash");
if (splash) splash.remove();
void H;
