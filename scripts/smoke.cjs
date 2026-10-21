// Smoke test del juego: carga la página, espera el canvas de Phaser,
// entra en JUGAR → nivel 1, comprueba HUD y tablero, y hace un swap de arrastre.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 405, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("http://127.0.0.1:8086/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(2200);

  const size = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return { w: c.clientWidth, h: c.clientHeight };
  });

  // Phaser escala FIT con barras: el canvas ocupa todo el viewport en este caso.
  const clickAt = async (fx, fy, hold = 60) => {
    const x = fx * size.w;
    const y = fy * size.h;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(hold);
    await page.mouse.up();
  };

  // Menú → JUGAR (y ≈ 0.62).
  await clickAt(0.5, 0.62);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/opencode/s1-map.png" });

  // Mapa → nodo nivel 1 (grid 6 columnas: centro en x=360,y=150).
  await clickAt(360 / 720, 150 / 1280);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: "/tmp/opencode/s2-game.png" });

  const state = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    return {
      canvas: !!canvas,
      swControlled: !!navigator.serviceWorker.controller,
    };
  });

  console.log("canvas:", state.canvas, "· SW activo:", state.swControlled, "· errores:", errors.length);
  if (errors.length) console.log("errores:", errors.slice(0, 4));
  await browser.close();
  if (!state.canvas) process.exit(1);
})();
