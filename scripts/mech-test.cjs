// Test de mecánica: swap inválido (se revierte) + swap válido (match, score>0).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://127.0.0.1:8086/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForTimeout(1800);

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
  await page.waitForTimeout(700);
  await clickAt(90 / 720, 170 / 1280);
  await page.waitForTimeout(1600);

  const dragCell = async (r1, c1, r2, c2) => {
    // Canvas coords → viewport (FIT 0.5625 exacto en 405×720).
    const X = (c) => ((72 + 72 * c + 36) / 720) * size.w;
    const Y = (r) => ((372 + 72 * r + 36) / 1280) * size.h;
    await page.mouse.move(X(c1), Y(r1));
    await page.mouse.down();
    await page.waitForTimeout(50);
    await page.mouse.move(X(c2), Y(r2), { steps: 6 });
    await page.waitForTimeout(60);
    await page.mouse.up();
    await page.waitForTimeout(500);
  };

  const snapshot = () =>
    page.evaluate(() => {
      const s = window.__puzzlebit.scene.getScene("Game");
      const b = s.engine.board;
      return {
        score: s.engine.score,
        moves: s.engine.movesLeft,
        key: b.grid.map((row) => row.map((c) => (c ? c.type : "-")).join("")).join("|"),
      };
    });

  const before = await snapshot();

  // 1) Swap inválido: probar pares hasta encontrar uno rebotado.
  let invalidPair = null;
  const pairEval = await page.evaluate(() => {
    const s = window.__puzzlebit.scene.getScene("Game");
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 7; c++) {
        const a = s.engine.board.get(r, c);
        const b = s.engine.board.get(r, c + 1);
        if (a && b && a.type !== b.type && !a.special && !b.special) return { r, c };
      }
    }
    return null;
  });
  invalidPair = pairEval;
  if (invalidPair) {
    await dragCell(invalidPair.r, invalidPair.c, invalidPair.r, invalidPair.c + 1);
    await page.waitForTimeout(2200); // revert + settle
  }
  const afterInvalid = await snapshot();

  // 2) Swap válido: usar el propio engine para localizar un movimiento.
  const move = await page.evaluate(() => {
    const s = window.__puzzlebit.scene.getScene("Game");
    const b = s.engine.board;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ]) {
          const r2 = r + dr;
          const c2 = c + dc;
          if (r2 >= 8 || c2 >= 8) continue;
          if (!b.isMovable(r, c) || !b.isMovable(r2, c2)) continue;
          const a = b.get(r, c);
          const bb = b.get(r2, c2);
          b.grid[r][c] = bb;
          b.grid[r2][c2] = a;
          // match check inline (única vez, ligero)
          const rowOk =
            c <= 5 &&
            b.get(r, c) &&
            b.get(r, c + 1) &&
            b.get(r, c + 2) &&
            !b.get(r, c).ingredient &&
            b.get(r, c).type === b.get(r, c + 1).type &&
            b.get(r, c).type === b.get(r, c + 2).type;
          const colOk =
            r <= 5 &&
            b.get(r, c) &&
            b.get(r + 1, c) &&
            b.get(r + 2, c) &&
            !b.get(r, c).ingredient &&
            b.get(r, c).type === b.get(r + 1, c).type &&
            b.get(r, c).type === b.get(r + 2, c).type;
          b.grid[r][c] = a;
          b.grid[r2][c2] = bb;
          if (rowOk || colOk) {
            const prompt = b.get(r, c).special !== "none" || b.get(r2, c2).special !== "none";
            if (prompt || rowOk || colOk) return { r1: r, c1: c, r2, c2 };
          }
        }
      }
    }
    return null;
  });

  let okValid = false;
  if (move) {
    await dragCell(move.r1, move.c1, move.r2, move.c2);
    await page.waitForTimeout(2600);
    const afterValid = await snapshot();
    okValid = afterValid.score > 0 && afterValid.moves < afterInvalid.moves;
    console.log("válido →", JSON.stringify(afterValid));
    await page.screenshot({ path: "/tmp/opencode/s3-after-match.png" });
  }

  const reverted =
    before.key === afterInvalid.key && before.score === afterInvalid.score && before.moves === afterInvalid.moves;
  console.log("inválido revertido:", reverted);
  console.log("válido produce match:", okValid);
  console.log("errores JS:", errors.length);
  if (errors.length) console.log(errors.slice(0, 3));
  await page.screenshot({ path: "/tmp/opencode/s4-final.png" });
  await browser.close();
  if (!reverted || !okValid) process.exit(1);
})();
