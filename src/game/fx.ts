import Phaser from "phaser";

/**
 * Ambiente por nivel: tinta el fondo con un tono propio del nivel
 * (hue determinista: cada nivel viste su atmósfera) y añade estrellitas
 * pixeladas flotando hacia arriba con parpadeo. Barato y con vida propia.
 */
export function addLevelAmbient(scene: Phaser.Scene, bgWall: Phaser.GameObjects.Image, levelId: number): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const hue = (levelId * 47 + 40) % 360;

  const atmo = Phaser.Display.Color.HSVToRGB(hue / 360, 0.5, 0.75) as { color: number };
  bgWall.setTint(atmo.color);
  const dark = Phaser.Display.Color.HSVToRGB(hue / 360, 0.4, 0.13) as { color: number };
  scene.cameras.main.setBackgroundColor(dark.color);

  // Estrellitas pixel: suben despacio, titilan y rebotan en el borde superior.
  const count = 22;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = 6 + Math.random() * 10;
    const dot = scene.add
      .image(x, y, "star")
      .setDisplaySize(size, size)
      .setAlpha(0.08 + Math.random() * 0.22);
    const subHue = (hue + 160 + i * 12) % 360;
    const tint = Phaser.Display.Color.HSVToRGB(subHue / 360, 0.6, 0.85) as { color: number };
    dot.setTint(tint.color);
    const drift = 9000 + Math.random() * 13000;
    scene.tweens.add({
      targets: dot,
      y: h + 30,
      duration: drift,
      repeat: -1,
      onRepeat: () => {
        dot.y = -30;
        dot.x = Math.random() * w;
      },
    });
    scene.tweens.add({
      targets: dot,
      alpha: dot.alpha + 0.16,
      duration: 1100 + Math.random() * 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

/**
 * Zoom de combo: acercamiento de cámara notorio para que las cascadas
 * grandes se sientan de golpear la mesa del arcade.
 * power 1 = x1.09, power 2 = x1.18: se usa en racha alto y cascadas fuertes.
 */
export function comboZoom(scene: Phaser.Scene, power = 1): void {
  const cam = scene.cameras.main;
  const zoom = 1 + 0.09 * Math.min(power, 2);
  scene.tweens.add({
    targets: cam,
    zoom,
    duration: 110,
    yoyo: true,
    ease: "Quad.easeIn",
    onComplete: () => cam.setZoom(1),
  });
}

/**
 * Efecto de pantalla completa: flash de color + zoom punch + marco
 * (viñeta) que se apaga. Con esto un combo grande se siente "de arcade".
 */
export function screenPunch(scene: Phaser.Scene, tint: number, power = 1): void {
  const r = Math.min(255, (tint >> 16) & 0xff);
  const g = Math.min(255, (tint >> 8) & 0xff);
  const b = Math.min(255, tint & 0xff);
  scene.cameras.main.flash(Math.round(80 + 70 * power), r, g, b);
  const cam = scene.cameras.main;
  const zoom = 1 + 0.028 * Math.min(power, 1.6);
  scene.tweens.add({
    targets: cam,
    zoom,
    duration: 90,
    yoyo: true,
    ease: "Sine.easeOut",
    onComplete: () => cam.setZoom(1),
  });
  const w = scene.scale.width;
  const h = scene.scale.height;
  const frame = scene.add
    .rectangle(w / 2, h / 2, w - 18, h - 18)
    .setStrokeStyle(Math.round(8 + 12 * Math.min(power, 1.5)), tint, 0.9)
    .setDepth(95);
  scene.tweens.add({ targets: frame, alpha: 0, duration: 360, onComplete: () => frame.destroy() });
}

/**
 * Overlay CRT: scanlines horizontales sutiles + margen oscuro suave.
 * Traslada la escena a un gabinete de los 90; muy barato de dibujar.
 */
export function addCRTOverlays(scene: Phaser.Scene, alpha = 0.11): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  if (!scene.textures.exists("scanline")) {
    const tex = scene.textures.createCanvas("scanline", 720, 4);
    if (tex) {
      const ctx = tex.getContext();
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, 0, 720, 2);
      ctx.clearRect(0, 2, 720, 2);
      tex.refresh();
    }
  }
  if (scene.textures.exists("scanline")) {
    const lines = scene.add.tileSprite(0, 0, w, h, "scanline");
    lines.setOrigin(0).setDepth(92).setAlpha(alpha).setScrollFactor(0);
  }
  // Franja oscura sutil abajo (suelo del gabinete).
  const vignette = scene.add.rectangle(w / 2, h - Math.max(20, h * 0.02), w, Math.max(36, h * 0.04), 0x000000, 0.55);
  vignette.setDepth(92).setAlpha(0.25);
}

/**
 * Onda expansiva desde un punto del tablero hasta cubrir toda la pantalla.
 * `power` (0..1+) escala el grosor y la velocidad.
 */
export function shockwave(scene: Phaser.Scene, x: number, y: number, tint: number, power = 0.5): void {
  const maxR = Math.hypot(scene.scale.width, scene.scale.height) * 1.15;
  const rings = power >= 1.2 ? [0, 90, 180] : power >= 0.9 ? [0, 90] : [0];
  for (const delay of rings) {
    const ring = scene.add.circle(x, y, Math.max(8, 18 * power), 0x000000, 0);
    ring.setStrokeStyle(Math.round(4 + 7 * Math.min(power, 1.6)), tint, 0.85);
    ring.setDepth(91).setScrollFactor(0);
    scene.tweens.add({
      targets: ring,
      radius: maxR * (0.8 + 0.35 * Math.min(power, 1.5)),
      alpha: 0,
      delay,
      duration: 320 + 180 * Math.min(power, 1.5),
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
  }
}

/**
 * Lluvia de destellos desde el cielo: celebra la creación de una especial.
 */
export function pixelRain(scene: Phaser.Scene, tint: number, count = 46): void {
  const w = scene.scale.width;
  if (!scene.textures.exists("star")) return;
  const emitter = scene.add.particles(0, 0, "star", {
    x: { min: 12, max: w - 12 },
    y: -12,
    lifespan: 950,
    speedY: { min: 160, max: 380 },
    speedX: { min: -50, max: 50 },
    scale: { min: 0.45, max: 1.1 },
    alpha: { start: 1, end: 0.25 },
    rotate: { min: -180, max: 180 },
    tint,
    quantity: Math.ceil(count / 6),
    frequency: 28,
  });
  emitter.setDepth(90);
  scene.time.delayedCall(170, () => emitter.stop());
  scene.time.delayedCall(1150, () => emitter.destroy());
}

/** Barrido de color que cruza la pantalla de lado a lado. */
export function colorSweep(scene: Phaser.Scene, tint = 0xffe14d): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const band = scene.add.rectangle(-w * 0.3, h / 2, w * 0.4, h, tint, 0.14);
  band.setDepth(89).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: band,
    x: w + w * 0.3,
    duration: 260,
    ease: "Sine.easeInOut",
    onComplete: () => band.destroy(),
  });
}

/** Megarompe: flash corto + triple onda desde el centro de la acción. */
export function megaBreak(scene: Phaser.Scene, x: number, y: number, tint: number): void {
  scene.cameras.main.flash(140, 255, 255, 255);
  shockwave(scene, x, y, 0xffffff, 1.4);
  shockwave(scene, x, y, tint, 1.0);
  pixelRain(scene, tint, 60);
}

/** Victoria: flash dorado, confeti multicolor a todo lo ancho y ondas. */
export function victorySplash(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  scene.cameras.main.flash(280, 255, 232, 130);
  shockwave(scene, w / 2, h / 2, 0xffe14d, 1.25);
  shockwave(scene, w / 2, h / 2, 0xffffff, 0.9);
  colorSweep(scene, 0xffe14d);
  const tints = [0xffe14d, 0x4dd6a0, 0xff5fa2, 0x4da3ff, 0xb06bff];
  for (let i = 0; i < tints.length; i++) {
    scene.time.delayedCall(i * 240, () => pixelRain(scene, tints[i], 48));
  }
}

