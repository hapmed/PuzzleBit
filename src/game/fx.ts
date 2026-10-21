import Phaser from "phaser";

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

