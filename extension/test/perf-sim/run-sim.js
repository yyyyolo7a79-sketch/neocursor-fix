// 仿真测试台驱动：在真实 Chromium 中运行注入脚本，逐帧测量"拖尾形状 vs 光标"的贴合度。
//
// 用法: node extension/test/perf-sim/run-sim.js
// 依赖: 全局 playwright（NODE_PATH 由运行命令指定）
//
// 指标定义：
//   前缘分离 = caretX - maxX   （正 = 形状右缘没追上光标左缘 → 视觉上"两个光标"）
//   覆盖像素 = 形状与光标矩形的重叠长度（0~8px，8px = 完全包住光标）
//   后缘滞后 = caretX - minX   （拖尾在光标后方延伸的长度）

const http = require("http");
const fs = require("fs");
const path = require("path");

const PW = process.env.PW_PATH || "C:/Users/PC/AppData/Roaming/npm/node_modules/playwright";
const { chromium } = require(PW);

const SIM_DIR = __dirname;
const SRC = path.resolve(SIM_DIR, "..", "..", "assets", "neovide-cursor.js");

// 每次运行都复制最新脚本（防止测到旧版——历史踩坑：浏览器缓存 / 文件过期）
fs.copyFileSync(SRC, path.join(SIM_DIR, "neovide-cursor.js"));

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]);
  const file = path.normalize(path.join(SIM_DIR, rel === "/" ? "sim.html" : rel.slice(1)));
  if (!file.startsWith(SIM_DIR)) { res.writeHead(403); return res.end("403"); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("404"); }
    res.writeHead(200, {
      "Cache-Control": "no-store", // 禁止缓存，确保每次测到的是最新脚本
      "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8",
    });
    res.end(buf);
  });
});

/** 均值 / P95 / 最大值 */
function st(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return {
    m: arr.reduce((a, b) => a + b, 0) / arr.length,
    p95: s[Math.floor((s.length - 1) * 0.95)],
    mx: s[s.length - 1],
  };
}

const f1 = (v) => (v == null ? "-" : v.toFixed(1));

function report(name, all) {
  const t0 = all.length ? all[0].t : 0;
  // 只统计：有形状 + 动画可见 + 跳过开头 400ms 瞬态
  const valid = all.filter((f) => f.n > 0 && f.op > 0.5 && f.t - t0 > 400);
  if (!valid.length) {
    console.log(`\n【${name}】无有效样本（形状未出现或场景太短）`);
    return;
  }
  const front = valid.map((f) => f.caretX - f.maxX);     // 前缘分离
  const trail = valid.map((f) => f.caretX - f.minX);     // 后缘滞后
  const width = valid.map((f) => f.maxX - f.minX);       // 形状宽度
  const cover = valid.map((f) => {
    const ov = Math.min(f.maxX, f.caretR) - Math.max(f.minX, f.caretX);
    return Math.max(0, Math.min(ov, f.caretR - f.caretX));
  });
  const F = st(front), T = st(trail), W = st(width), C = st(cover);
  const coverRate = (cover.filter((c) => c > 0.5).length / cover.length) * 100;
  console.log(`\n【${name}】有效帧 ${valid.length}`);
  console.log(`  前缘分离 caretX-maxX : 均值 ${f1(F.m)}px  P95 ${f1(F.p95)}px  最大 ${f1(F.mx)}px   （正=分离，负=覆盖光标 ${f1(-F.m)}px）`);
  console.log(`  覆盖光标像素          : 均值 ${f1(C.m)}/8px   有重叠帧占比 ${coverRate.toFixed(0)}%`);
  console.log(`  后缘滞后 caretX-minX : 均值 ${f1(T.m)}px  （拖尾向后延伸长度）`);
  console.log(`  形状总宽度            : 均值 ${f1(W.m)}px`);
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  console.log(`测试服务器: http://127.0.0.1:${port}/sim.html`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on("console", (m) => {
    if (m.type() === "warning" || m.type() === "error") console.log("  [页面]", m.text());
  });
  page.on("pageerror", (e) => console.log("  [页面异常]", e.message));

  await page.goto(`http://127.0.0.1:${port}/sim.html`);
  await page.waitForFunction("window.__sceneReady === true");
  await page.waitForSelector("canvas", { timeout: 8000 }); // 等注入脚本启动（load 后 1.5s）
  await page.waitForTimeout(500);

  const scenes = [
    { name: "按住键 repeat（33ms / 8px）", fn: () => window.__scene.keyRepeat({}), hold: 2600 },
    { name: "手动打字（160ms / 8px）", fn: () => window.__scene.typing({}), hold: 3000 },
    { name: "鼠标乱晃（16ms / ±20px 随机游走）", fn: () => window.__scene.swing({}), hold: 2100 },
    { name: "单次大跳（+400px）", fn: () => window.__scene.jumpOnce(), hold: 1200 },
  ];

  for (const sc of scenes) {
    await page.evaluate(() => window.__scene.reset()); // 复位并等动画收敛
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.__samples.length = 0; });
    await page.evaluate(sc.fn);
    await page.waitForTimeout(sc.hold);
    const s = await page.evaluate(() => window.__samples.slice());
    report(sc.name, s);
  }

  // DUMP=1：在 keyRepeat 稳定期抓一帧形状快照，用字符画打出真实几何形状
  if (process.env.DUMP === "1") {
    await page.evaluate(() => window.__scene.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__scene.keyRepeat({ durationMs: 5000 }));
    await page.waitForTimeout(1500);
    const snap = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const caret = document.getElementById("caret");
      const r = caret.getBoundingClientRect();
      const x0 = Math.max(0, Math.floor(r.left - 40));
      const x1 = Math.min(canvas.width, Math.ceil(r.right + 24));
      const y0 = Math.max(0, Math.floor(r.top - 8));
      const y1 = Math.min(canvas.height, Math.ceil(r.bottom + 8));
      const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
      const rows = [];
      for (let y = 0; y < y1 - y0; y += 2) {
        let line = "";
        for (let x = 0; x < x1 - x0; x += 2) {
          const a = img.data[(y * (x1 - x0) + x) * 4 + 3];
          line += a > 200 ? "#" : a > 40 ? "+" : ".";
        }
        rows.push(line);
      }
      return { caretL: r.left, caretT: r.top, x0, y0, rows };
    });
    console.log(`\n===== 形状快照（keyRepeat 进行中）=====`);
    console.log(`光标视口位置: left=${snap.caretL.toFixed(1)}  top=${snap.caretT.toFixed(1)}（宽 8px）`);
    console.log(`左边界 x0=${snap.x0}；字符画每格 = 2px；"#"=实心 "+"=阴影 "."=空`);
    console.log(`光标左缘位于第 ${((snap.caretL - snap.x0) / 2).toFixed(0)} 格，右缘第 ${((snap.caretL - snap.x0) / 2 + 4).toFixed(0)} 格`);
    snap.rows.forEach((row, i) => console.log(`  y=${String(snap.y0 + i * 2).padStart(4)} ${row}`));
  }

  const shot = process.env.SHOT;
  if (shot) {
    // 截一张"场景进行中"的形态图（默认 keyRepeat 中途）
    await page.evaluate(() => window.__scene.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__scene.keyRepeat({ durationMs: 3000 }));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: shot });
    console.log(`\n截图已保存: ${shot}`);
  }

  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
