// Smoke del modo infinito: progreso precargado → nodo ∞ → juega el nivel 51.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 405, height: 720 } });
  // Desbloquea el modo infinito antes de que arranque la app.
  await context.addInitScript(() => {
    localStorage.setItem("pb.progress.v1", JSON.stringify({ "1": { stars: 3, bestScore: 5000, completed: true } }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("http://127.0.0.1:8086/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => window.__puzzlebit.scene.start("LevelMap"));
  await page.waitForTimeout(900);

  // Nodo ∞: posición en unidades de juego + tamaño real del canvas.
  const node = await page.evaluate(() => {
    const g = window.__puzzlebit;
    const scene = g.scene.getScene("LevelMap");
    let pos = null;
    for (const c of scene.children.list) {
      if (c.list && c.list.some((i) => i.text && i.text.startsWith("∞"))) {
        pos = { x: c.x, y: c.y, label: c.list.find((i) => i.text && i.text.startsWith("∞")).text };
      }
    }
    const rect = document.querySelector("canvas").getBoundingClientRect();
    return { pos, rect: { w: rect.width, h: rect.height }, gw: g.scale.gameSize.width, gh: g.scale.gameSize.height };
  });
  console.log("nodo ∞ en mapa:", node.pos && node.pos.label, node.pos);

  if (node.pos) {
    const px = (node.pos.x / node.gw) * node.rect.w;
    const py = (node.pos.y / node.gh) * node.rect.h;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(2000);

    const inGame = await page.evaluate(() => {
      const g = window.__puzzlebit;
      const gameScene = g.scene.getScene("Game");
      const engine = gameScene.engine;
      return {
        active: g.scene.isActive("Game"),
        levelId: engine?.level?.id ?? null,
        name: engine?.level?.name ?? null,
        objectives: engine?.objectives?.map((o) => `${o.kind}:${o.target}`) ?? [],
        moves: engine?.movesLeft ?? null,
      };
    });
    console.log("en juego:", JSON.stringify(inGame));
    await page.screenshot({ path: "/tmp/opencode/s3-endless.png" });

    // swap válido: encuentra un swap que produzca match usando el motor (probar swaps adyacentes).
    const swapped = await page.evaluate(() => {
      const gs = window.__puzzlebit.scene.getScene("Game");
      const engine = gs.engine;
      const R = engine.level.rows, C = engine.level.cols;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C - 1; c++) {
          const res = engine.attemptSwap({ r, c }, { r, c: c + 1 });
          if (res && res.ok) return true;
        }
      }
      return false;
    });
    console.log("swap válido encontrado en nivel ∞ 51:", swapped);
  }

  console.log("errores:", errors.length, errors.slice(0, 4));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
