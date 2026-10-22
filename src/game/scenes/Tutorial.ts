import Phaser from "phaser";
import { W, H } from "../config";
import { addCRTOverlays, addLevelAmbient, screenPunch } from "../fx";
import { announce, playSfx } from "../sfx";
import { markTutorialDone } from "../state";

type Page = {
  title: string;
  draw: (scene: Phaser.Scene, cx: number, cy: number) => Phaser.GameObjects.GameObject[];
};

const MONO = '"Courier New", monospace';

/** Fila de piezas iguales (ilustración). */
function rowOf(scene: Phaser.Scene, cx: number, cy: number, tex: string, n: number, size = 44): Phaser.GameObjects.Image[] {
  const imgs: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < n; i++) {
    const img = scene.add.image(cx + (i - (n - 1) / 2) * (size + 6), cy, tex).setDisplaySize(size, size);
    imgs.push(img);
  }
  return imgs;
}

/** Instrucciones de primera vez: cómo se juega, formas mágicas y reglas. */
export class TutorialScene extends Phaser.Scene {
  private pageIdx = 0;
  private levelId = 1;
  private body?: Phaser.GameObjects.Container;
  private pageTitle?: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private navPrev!: Phaser.GameObjects.Text;
  private navNext!: Phaser.GameObjects.Text;
  private pages: Page[] = [];

  constructor() {
    super("Tutorial");
  }

  init(data: { levelId?: number }): void {
    this.levelId = data.levelId ?? 1;
  }

  create(): void {
    this.cameras.main.fadeIn(220, 0, 0, 0);
    const bgWall = this.add.image(W / 2, H / 2, "bg").setDisplaySize(W, H).setAlpha(0.35);
    addLevelAmbient(this, bgWall, this.levelId);
    addCRTOverlays(this);
    playSfx(this, "start");

    this.pages = [
      {
        title: "¿CÓMO SE JUEGA?",
        draw: (scene, cx, cy) => {
          const out: Phaser.GameObjects.GameObject[] = [];
          out.push(...this.line3Demo(scene, cx, cy - 110));
          out.push(scene.add.text(cx, cy + 40, "Arrastra una pieza a su vecina", { fontFamily: MONO, fontSize: "21px", color: "#ffffff", wordWrap: { width: W - 140 }, align: "center" }).setOrigin(0.5));
          out.push(scene.add.text(cx, cy + 96, "y arma líneas de 3 o más del mismo color: ¡puf! se rompen y caen nuevas.", { fontFamily: MONO, fontSize: "21px", color: "#ffd95e", wordWrap: { width: W - 150 }, align: "center" }).setOrigin(0.5));
          return out;
        },
      },
      {
        title: "FORMAS MÁGICAS",
        draw: (scene, cx, cy) => {
          const out: Phaser.GameObjects.GameObject[] = [];
          const rows: Array<[string, string, number]> = [
            ["rayada", "4 en línea → limpia una fila", 4],
            ["envuelta", "cruce en L o T → estallido 3×3", 2],
            ["dado", "cuadro 2×2 → repinta y enreda", 5],
            ["bomba", "5 en línea → arrasa un color", 6],
          ];
          const textures: Record<string, string> = {
            rayada: "piece4-stripe-h",
            envuelta: "piece2-wrapped",
            dado: "piece3-dice",
            bomba: "piece-bomb",
          };
          rows.forEach(([key, text, n], i) => {
            const y = cy - 170 + i * 78;
            out.push(...rowOf(scene, cx - 110, y, key === "bomba" ? "piece5" : "piece1", n, 34));
            out.push(scene.add.text(cx - 36, y, "→", { fontFamily: MONO, fontSize: "24px", color: "#6a56ad" }).setOrigin(0.5));
            out.push(scene.add.image(cx + 14, y, textures[key]).setDisplaySize(44, 44));
            out.push(scene.add.text(cx + 46, y, text, { fontFamily: MONO, fontSize: "17px", color: "#ffffff" }).setOrigin(0, 0.5));
          });
          out.push(scene.add.text(cx, cy + 170, "Combínalas entre sí para desastres mayores.", { fontFamily: MONO, fontSize: "18px", color: "#ff9a3d", align: "center" }).setOrigin(0.5));
          return out;
        },
      },
      {
        title: "LAS REGLAS",
        draw: (scene, cx, cy) => {
          const out: Phaser.GameObjects.GameObject[] = [];
          const rules = [
            "• Cada nivel da movimientos contados: gástalos bien.",
            "• Cumple el objetivo (puntos, piezas, jelly,\ningredientes) y ganas estrellas.",
            "• Si al romper caen piezas y rompen solas:\ncascada = combo con puntos multiplicados.",
            "• Jelly (cristal bajo la pieza): se limpia rompiendo\nla pieza que la tiene.",
            "• Cajas: les pegas con especiales o el martillo 🔨.",
            "• Los ingredientes viajan hasta la base del tablero.",
            "• Sin jugadas posibles → el tablero se remezcla solo.",
            "• Rompe en cascada seguida y verás la RACHA 🔥.",
          ];
          rules.forEach((r, i) => {
            out.push(scene.add.text(cx, cy - 196 + i * 58, r, { fontFamily: MONO, fontSize: "17px", color: "#ffffff", align: "left" }).setOrigin(0, 0));
          });
          return out;
        },
      },
      {
        title: "¡A JUGAR!",
        draw: (scene, cx, cy) => {
          const out: Phaser.GameObjects.GameObject[] = [];
          out.push(...rowOf(scene, cx, cy - 70, "piece5", 3, 52));
          out.push(scene.add.image(cx, cy + 50, "star").setDisplaySize(96, 96));
          out.push(scene.add.text(cx, cy + 140, "Las estrellas se ganan con puntos.\n¡Tienes esto!", { fontFamily: MONO, fontSize: "20px", color: "#4dd6a0", align: "center", wordWrap: { width: W - 140 } }).setOrigin(0.5));
          return out;
        },
      },
    ];

    // Botón saltar (arriba a la derecha).
    const skip = this.add.text(W - 24, 26, "saltar ✕", {
      fontFamily: MONO, fontSize: "18px", color: "#6a56ad", fontStyle: "bold",
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    skip.on("pointerdown", () => this.finish());

    // Botones anterior / siguiente.
    this.navPrev = this.add.text(70, H - 64, "◀ atrás", { fontFamily: MONO, fontSize: "20px", color: "#b0a6d9" }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.navNext = this.add.text(W - 70, H - 64, "sig ▶", { fontFamily: MONO, fontSize: "20px", color: "#ffd95e", fontStyle: "bold" }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.navPrev.on("pointerdown", () => this.go(-1));
    this.navNext.on("pointerdown", () => this.go(1));

    // Puntos de progreso.
    for (let i = 0; i < this.pages.length; i++) {
      this.dots.push(this.add.circle(W / 2 + (i - (this.pages.length - 1) / 2) * 30, H - 112, 7, 0x6a56ad));
    }

    this.showPage(0);
  }

  /** Ilustra el swap: dos piezas + flecha + 3 en línea. */
  private line3Demo(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    out.push(scene.add.image(cx - 190, cy, "piece3").setDisplaySize(52, 52));
    out.push(scene.add.image(cx - 118, cy, "piece4").setDisplaySize(52, 52));
    out.push(scene.add.text(cx - 154, cy - 46, "⇄", { fontFamily: MONO, fontSize: "34px", color: "#ffd95e" }).setOrigin(0.5));
    out.push(scene.add.rectangle(cx - 154, cy, 140, 64, 0xffffff, 0).setStrokeStyle(3, 0xffd95e));
    out.push(scene.add.text(cx - 60, cy, "→", { fontFamily: MONO, fontSize: "34px", color: "#6a56ad" }).setOrigin(0.5));
    out.push(...rowOf(scene, cx + 110, cy, "piece4", 3, 52));
    return out;
  }

  private showPage(idx: number): void {
    this.pageIdx = idx;
    this.pageTitle?.destroy();
    this.body?.destroy();
    const page = this.pages[idx];
    const cx = W / 2;
    this.pageTitle = this.add.text(cx, 92, page.title, {
      fontFamily: MONO, fontSize: "34px", color: "#ffd95e", fontStyle: "bold",
    }).setOrigin(0.5).setStroke("#14102b", 6).setDepth(11);
    const bodyParts = page.draw(this, cx, H / 2 + 30);
    this.body = this.add.container(0, 0, bodyParts).setDepth(10);
    // Entrada en cascada de pieza por pieza.
    let i = 0;
    for (const k of this.body.list) {
      const target = k as Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      if (!target.setAlpha) continue;
      target.setAlpha(0);
      this.tweens.add({ targets: target, alpha: 1, duration: 220, delay: 50 + i * 45 });
      i++;
    }
    this.dots.forEach((d, di) => d.setFillStyle(di === idx ? 0xffd95e : 0x6a56ad));
    this.navPrev.setAlpha(idx === 0 ? 0.3 : 1);
    this.navNext.setText(idx === this.pages.length - 1 ? "¡A JUGAR! ▶" : "sig ▶");
    if (idx === this.pages.length - 1) {
      screenPunch(this, 0xffd95e, 0.6);
    }
  }

  private go(dir: number): void {
    const nextIdx = this.pageIdx + dir;
    if (nextIdx >= this.pages.length) {
      this.finish();
      return;
    }
    if (nextIdx < 0) return;
    playSfx(this, "click");
    this.showPage(nextIdx);
  }

  /** Termina el tutorial: marca visto y arranca el nivel pendiente. */
  private finish(): void {
    markTutorialDone();
    playSfx(this, "special");
    screenPunch(this, 0x4dd6a0, 0.8);
    announce("¡Hora de jugar!", this);
    this.time.delayedCall(240, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start("Game", { levelId: this.levelId }));
    });
  }
}
