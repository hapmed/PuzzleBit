// Debug: entra en nivel 1 y muestra objetivos y estado de sprites.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  await page.goto("http://127.0.0.1:8086/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1800);
  const info = await page.evaluate(() => {
    const g = window.__puzzlebit;
    const tex = g.textures;
    const piece = tex.get("piece1");
    return {
      pieceSize: piece ? [piece.getSourceImage().width, piece.getSourceImage().height] : null,
    };
  });
  console.log("textura piece1:", info.pieceSize);

  // Entra al juego.
  const size = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    return { w: c.clientWidth, h: c.clientHeight };
  });
  const clickAt = async (fx, fy) => {
    await page.mouse.move(fx * size.w, fy * size.h);
    await page.mouse.down();
    await page.mouse.up();
  };
  await clickAt(0.5, 0.62);
  await page.waitForTimeout(800);
  await clickAt(90 / 720, 170 / 1280);
  await page.waitForTimeout(1500);

  const state = await page.evaluate(() => {
    const g = window.__puzzlebit;
    const s = g.scene.getScene("Game");
    const bv = s.boardView;
    const o = s.engine.objectives;
    const a = bv.sprites.values().next().value;
    return {
      objetivos: o.map((x) => `${x.kind}/${x.target}=${x.progress}`),
      cellSize: bv.cellSize,
      sprite: a ? { display: [a.displayWidth, a.displayHeight], scale: a.scale, tex: a.texture.key, texW: a.texture.getSourceImage().width } : null,
    };
  });
  console.log(JSON.stringify(state, null, 1));
  await browser.close();
})();
