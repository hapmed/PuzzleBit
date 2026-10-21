const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 405, height: 720 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 200)); });
  await page.goto("http://127.0.0.1:8086/", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(800);
  const t1 = await page.evaluate(() => {
    const pre = window.__puzzlebit.scene.getScene("Preload");
    return { now: Math.round(pre.time.now), frame: pre.time.frame, coinY: pre.children ? null : null,
      todos: pre.time._active ? pre.time._active.length : "n/a" };
  });
  await page.waitForTimeout(1200);
  const t2 = await page.evaluate(() => {
    const pre = window.__puzzlebit.scene.getScene("Preload");
    return { now: Math.round(pre.time.now), frame: pre.time.frame, audioLoaded: Object.keys(pre.load.cacheManager || {}).length };
  });
  console.log("clock t1:", JSON.stringify(t1));
  console.log("clock t2:", JSON.stringify(t2));
  const audio = await page.evaluate(() => {
    const g = window.__puzzlebit;
    const list = [];
    g.scene.getScene("Preload").load.cacheFile?.entries?.forEach?.((v, k) => list.push(k));
    return { pending: g.scene.getScene("Preload").load.totalFailed ?? null, stored: list.slice(0, 5).join(",") };
  });
  console.log("audio:", JSON.stringify(audio));
  await browser.close();
})();
