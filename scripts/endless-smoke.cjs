// Smoke del modo infinito: entra directo al nivel ∞ y juega (sin pantalla de niveles).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 405, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const BASE = process.env.BASE_URL || "http://127.0.0.1:8086";

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(3200); // coin + fade + arranque del juego

  // El arranque directo va al último nivel jugado; saltamos al ∞ 51 con el registro.
  const inGame = await page.evaluate(() => {
    const g = window.__puzzlebit;
    return { active: g.scene.isActive("Game"), engineId: g.scene.getScene("Game").engine?.level?.id ?? null };
  });
  console.log("arranque directo:", JSON.stringify(inGame));

  const after = await page.evaluate(() => {
    const g = window.__puzzlebit;
    g.scene.getScene("Game").scene.restart({ levelId: 51 });
    return true;
  });
  await page.waitForTimeout(2200);
  const endless = await page.evaluate(() => {
    const g = window.__puzzlebit;
    const gm = g.scene.getScene("Game");
    const engine = gm.engine;
    return {
      active: g.scene.isActive("Game"),
      levelId: engine?.level?.id ?? null,
      name: engine?.level?.name ?? null,
      objectives: engine?.objectives?.map((o) => `${o.kind}:${o.target}`) ?? [],
      moves: engine?.movesLeft ?? null,
    };
  });
  console.log("nivel ∞ 51:", JSON.stringify(endless));

  // swap válido: el motor garantiza movimientos con reshuffle.
  const swapped = await page.evaluate(() => {
    const engine = window.__puzzlebit.scene.getScene("Game").engine;
    const R = engine.level.rows, C = engine.level.cols;
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C - 1; c++) {
        const res = engine.attemptSwap({ r, c }, { r, c: c + 1 });
        if (res && res.ok) return true;
      }
    }
    return false;
  });
  console.log("swap válido en ∞ 51:", swapped);

  console.log("errores:", errors.length, errors.slice(0, 4));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
