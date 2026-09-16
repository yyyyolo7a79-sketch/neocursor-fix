// 金标准测试：连接真实 VS Code（CDP remote-debugging），在真实编辑器里模拟
// "按住键快速输入"，逐帧测量拖尾形状与光标的贴合度。
//
// 用法: node extension/test/perf-sim/real-vscode-test.js
//
// 特点：
//  - 使用独立的 user-data-dir（不干扰正在运行的 VS Code / 用户配置）
//  - 预置 settings：cursorSmoothCaretAnimation="on"（与用户环境一致，可验证
//    注入的 "transition: none !important" 是否真的覆盖了 Monaco 的 80ms 过渡）
//  - 启动前会把 assets/neovide-cursor.js 的**当前工作副本**复制到 VS Code 的
//    workbench 目录（等效"扩展重新注入"），因此测到的永远是最新代码

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execSync } = require("child_process");

const PW = process.env.PW_PATH || "C:/Users/PC/AppData/Roaming/npm/node_modules/playwright";
const { chromium } = require(PW);

// NC_EDITOR=cursor 时可对 Cursor 做同样的金标准测试（默认 VS Code）
const EDITOR = process.env.NC_EDITOR === "cursor" ? "cursor" : "code";
const EDITOR_EXE = EDITOR === "cursor"
  ? "D:/develop/Cursor/cursor/Cursor.exe"
  : "D:/develop/Microsoft VS Code/Code.exe";
const INSTALL_ROOT = EDITOR === "cursor"
  ? "D:/develop/Cursor/cursor"
  : "D:/develop/Microsoft VS Code";

/** 自动探测 workbench 目录（兼容两种结构：<install>/<hash>/resources/app/...（VS Code zip 版）
 *  与 <install>/resources/app/...（Cursor 标准安装）；多命中时取最近修改的版本目录） */
function probeWbDir(installRoot) {
  const bases = [installRoot]; // Cursor：resources/app 直接在安装根下
  try {
    for (const e of fs.readdirSync(installRoot, { withFileTypes: true })) {
      if (e.isDirectory()) bases.push(path.join(installRoot, e.name)); // VS Code：<hash>/
    }
  } catch (err) { /* ignore */ }
  let best = null, bestMtime = 0;
  for (const b of bases) {
    for (const rel of ["out/vs/code/electron-sandbox/workbench", "out/vs/code/electron-browser/workbench"]) {
      const p = path.join(b, "resources", "app", rel);
      try {
        if (fs.existsSync(p)) {
          const mt = fs.statSync(p).mtimeMs;
          if (!best || mt > bestMtime) { best = p; bestMtime = mt; }
        }
      } catch (err) { /* ignore */ }
    }
  }
  return best;
}
const WB_DIR = probeWbDir(INSTALL_ROOT);
if (!WB_DIR) throw new Error("未能探测到 workbench 目录: " + INSTALL_ROOT);
// NC_SCRIPT：可指定任意脚本文件作为被测对象（用于与历史版本做基准对照）
const SRC_SCRIPT = process.env.NC_SCRIPT || path.resolve(__dirname, "..", "..", "assets", "neovide-cursor.js");

const PORT = EDITOR === "cursor" ? 9444 : 9333;
const PROFILE = path.join(os.tmpdir(), "neovide-cdp-profile-" + EDITOR);
const TESTFILE = path.join(os.tmpdir(), "neovide-cdp-test" + (EDITOR === "cursor" ? "-cursor" : "") + ".js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

(async () => {
  // 1. 给工作副本打诊断补丁（暴露内部状态）后写入注入位置
  //    （等效"扩展重新注入" + 测试专用钩子；目录中有 .bak 备份可还原）
  let code = fs.readFileSync(SRC_SCRIPT, "utf-8");
  const patches = [
    ["const start = () => setTimeout(() => new GlobalCursorManager(), START_DELAY);",
     "const start = () => setTimeout(() => { window.__ncMgr = new GlobalCursorManager(); }, START_DELAY);"],
    // 注意：源码为 CRLF 行尾，多行锚点不可靠——一律用单行锚点
    ["    // move 方法: 外部驱动接口, 告诉插件光标的目标坐标",
     "    __corners: corners, __dest: () => centerDest,\r\n    // move 方法: 外部驱动接口, 告诉插件光标的目标坐标"],
    ["    move: (x, y, fromSource = null) => {",
     "    move: (x, y, fromSource = null) => {\n      window.__ncMoveCount = (window.__ncMoveCount || 0) + 1;"],
  ];
  for (const [o, n] of patches) {
    if (code.includes(o)) code = code.replace(o, n);
    else console.log("  （诊断补丁锚点缺失，跳过一项——历史版本对照时正常）");
  }
  fs.writeFileSync(path.join(WB_DIR, "neovide-cursor.js"), code);
  console.log("✅ 工作副本（含诊断钩子）已复制到 VS Code 注入位置");

  // 2. 独立 profile + 与用户一致的设置
  fs.mkdirSync(path.join(PROFILE, "User"), { recursive: true });
  fs.writeFileSync(path.join(PROFILE, "User", "settings.json"), JSON.stringify({
    "editor.cursorSmoothCaretAnimation": "on",
    "editor.quickSuggestions": false,
    "editor.minimap.enabled": false,
    "workbench.startupEditor": "none",
    "window.restoreWindows": "none",
    "telemetry.telemetryLevel": "off",
    "update.mode": "none",
  }, null, 2));
  // 使用长行（约 660px/行）以贴近真实代码文件——跨行时的位移量与真实场景一致
  fs.writeFileSync(TESTFILE, "// neovide CDP 测试文件（用于输入 'a'）\n" + ("// " + "填充内容".repeat(20) + "\n").repeat(80));

  // 3. 启动 VS Code（独立 profile；不会附加到用户已开的实例）
  const proc = spawn(EDITOR_EXE, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--new-window",
    TESTFILE,
  ], { stdio: "ignore" });
  console.log(`🚀 VS Code 启动中 (pid=${proc.pid})…`);

  const cleanup = () => {
    try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: "ignore" }); } catch (e) {}
  };
  process.on("exit", cleanup);

  // 4. 等 CDP 端口就绪
  const t0 = Date.now();
  let ready = false;
  while (Date.now() - t0 < 40000) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) { ready = true; break; }
    } catch (e) {}
    await sleep(500);
  }
  if (!ready) throw new Error("CDP 端口等待超时");
  console.log("✅ CDP 端口就绪");

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];

  // 5. 找 workbench 页面
  let page = null;
  const tp = Date.now();
  while (!page && Date.now() - tp < 40000) {
    for (const p of ctx.pages()) {
      if (p.url().includes("workbench")) { page = p; break; }
    }
    if (!page) await sleep(500);
  }
  if (!page) throw new Error("未找到 workbench 页面：" + ctx.pages().map((p) => p.url()).join(" | "));
  console.log("✅ 已连接 workbench 页面");

  // 6. 等编辑器光标 + 注入脚本就绪
  await page.waitForSelector(".monaco-editor .cursor", { timeout: 60000 });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll("canvas")].some((c) => c.style.position === "fixed" && c.style.zIndex === "9999");
  }, { timeout: 40000 });
  console.log("✅ 编辑器光标 + 注入脚本就绪");
  await sleep(500);

  // 7. 环境诊断（H2 验证核心：transition 是否真的被 !important 禁用）
  const diag = await page.evaluate(() => {
    const el = document.querySelector(".monaco-editor .cursor");
    const cs = getComputedStyle(el);
    const layer = el.offsetParent;
    const lcs = layer ? getComputedStyle(layer) : null;
    return {
      cursorCount: document.querySelectorAll(".monaco-editor .cursor").length,
      cursorSize: { w: el.offsetWidth, h: el.offsetHeight },
      cursorTransition: cs.transition,
      cursorTransitionProperty: cs.transitionProperty,
      cursorTransitionDuration: cs.transitionDuration,
      layerClassName: layer ? layer.className : null,
      layerPaddingLeft: lcs ? lcs.paddingLeft : null,
      hasInjectedCanvas: [...document.querySelectorAll("canvas")].some((c) => c.style.zIndex === "9999"),
      dpr: window.devicePixelRatio,
      editorTotalWidth: (document.querySelector(".monaco-editor") || {}).clientWidth,
    };
  });
  console.log("\n===== 环境诊断 =====");
  console.log(JSON.stringify(diag, null, 2));

  // 8. 聚焦编辑器：用真实鼠标点击（纯 DOM focus() 会被 VS Code 的布局逻辑覆盖）
  const meta = await page.evaluate(() => ({ title: document.title, url: location.href }));
  console.log("页面:", JSON.stringify(meta));
  const clickPos = await page.evaluate(() => {
    const ed = document.querySelector(".monaco-editor");
    const r = ed.getBoundingClientRect();
    return { x: Math.round(r.left + r.width * 0.4), y: Math.round(r.top + 60) };
  });
  await page.mouse.click(clickPos.x, clickPos.y);
  await sleep(400);
  const focusInfo = await page.evaluate(() => {
    const a = document.activeElement;
    const cur = document.querySelector(".monaco-editor .cursor");
    const r = cur ? cur.getBoundingClientRect() : null;
    const line = document.querySelector(".view-lines .view-line");
    return {
      active: a ? `${a.tagName}.${a.className}` : "(无)",
      cursorRect: r ? { l: +r.left.toFixed(1), t: +r.top.toFixed(1), w: r.width, h: r.height } : null,
      cursorDisplay: cur ? getComputedStyle(cur).display : null,
      firstLine: line ? line.textContent.slice(0, 40) : null,
    };
  });
  console.log("聚焦结果:", JSON.stringify(focusInfo));

  // 9. 安装帧级采样探针（在注入脚本之后注册 rAF → 每帧读取"刚绘制完"的 canvas）
  await page.evaluate(() => {
    window.__real = [];
    const PAD_L = 90, PAD_R = 40, PAD_T = 60, PAD_B = 60;
    function findCanvas() {
      return [...document.querySelectorAll("canvas")].find((c) => c.style.position === "fixed" && c.style.zIndex === "9999");
    }
    function tick() {
      const el = document.querySelector(".monaco-editor .cursor");
      const canvas = findCanvas();
      if (el && canvas && canvas.width > 0) {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // 目标值（style.left，脚本定位所用）换算到视口坐标，与"实际渲染位置"对比：
        // 两者不等 ⇒ 光标存在插值/平滑动画（形状按目标值跟随会超前于可见光标）
        let styleX = null;
        try {
          const sl = parseFloat(el.style.left);
          const anchor = el.offsetParent;
          if (!isNaN(sl) && anchor) {
            const ar = anchor.getBoundingClientRect();
            styleX = ar.left + anchor.clientLeft + sl;
          }
        } catch (e2) { /* ignore */ }
        const vis = cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0;
        if (vis) {
          const ctx = canvas.getContext("2d");
          const x0 = Math.max(0, Math.floor(r.left - PAD_L));
          const y0 = Math.max(0, Math.floor(r.top - PAD_T));
          const w = Math.min(canvas.width - x0, Math.ceil(r.width + PAD_L + PAD_R));
          const h = Math.min(canvas.height - y0, Math.ceil(r.height + PAD_T + PAD_B));
          if (w > 0 && h > 0) {
            const img = ctx.getImageData(x0, y0, w, h);
            const d = img.data;
            let minX = 1e9, maxX = -1e9, n = 0;
            for (let y = 0; y < h; y++) {
              const row = y * w * 4;
              for (let x = 0; x < w; x++) {
                if (d[row + x * 4 + 3] > 200) { if (x < minX) minX = x; if (x > maxX) maxX = x; n++; }
              }
            }
            // 内部状态（诊断钩子；脚本未打补丁时为 null）
            let dbg = null;
            const mgr = window.__ncMgr;
            if (mgr) {
              for (const [el2, d] of mgr.cursors) {
                if (el2 !== el) continue;
                try {
                  const dd = d.instance.__dest();
                  dbg = {
                    mv: window.__ncMoveCount || 0,
                    lastX: +(d.lastX ?? 0).toFixed(1),
                    act: !!d.isActive,
                    dest: [+dd.x.toFixed(1), +dd.y.toFixed(1)],
                    cn: d.instance.__corners.map((c) => ({
                      rp: [c.rp.x, c.rp.y],
                      cp: [+c.cp.x.toFixed(1), +c.cp.y.toFixed(1)],
                      pd: [+c.pd.x.toFixed(1), +c.pd.y.toFixed(1)],
                      ax: [+c.ax.position.toFixed(2), Math.round(c.ax.velocity), c.ax.animationLength],
                    })),
                  };
                } catch (e) { dbg = { err: String(e) }; }
                break;
              }
            }
            window.__real.push({
              t: performance.now(),
              caretX: r.left, caretR: r.right, styleX,
              minX: n ? minX + x0 : null, maxX: n ? maxX + x0 : null, n,
              op: parseFloat(canvas.style.opacity || "0"),
              dbg,
            });
          }
        } else {
          // 光标不可见时不采样形状，但记录一行诊断（帮助排查"为何无样本"）
          window.__real.push({ t: performance.now(), caretX: r.left, caretR: r.right, minX: null, maxX: null, n: 0, op: parseFloat(canvas.style.opacity || "0"), inv: true });
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  // 10. 快速输入（33ms/字符 ≈ 按住键的 repeat 节奏）
  console.log("\n⌨️  快速输入 30 个字符（33ms 间隔）…");
  await page.evaluate(() => { window.__real.length = 0; });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("a");
    await sleep(33);
  }
  await page.evaluate(() => { window.__stoppedAt = performance.now(); }); // 记录停止时刻，供收敛测量
  await sleep(400);

  // 11. 统计
  async function sampleStats(label) {
    const all = await page.evaluate(() => window.__real.slice());
    const valid = all.filter((f) => f.n > 0 && f.op > 0.5);
    if (!valid.length) {
      const invCount = all.filter((f) => f.inv).length;
      console.log(`⚠️【${label}】无有效样本：共 ${all.length} 帧，其中光标不可见 ${invCount} 帧`);
      return;
    }
    const front = valid.map((f) => f.caretX - f.maxX);
    const trail = valid.map((f) => f.caretX - f.minX);
    const width = valid.map((f) => f.maxX - f.minX);
    const cw = diag.cursorSize.w;
    const cover = valid.map((f) => {
      const ov = Math.min(f.maxX, f.caretR) - Math.max(f.minX, f.caretX);
      return Math.max(0, Math.min(ov, f.caretR - f.caretX));
    });
    const F = st(front), T = st(trail), W = st(width), C = st(cover);
    const coverRate = (cover.filter((c) => c > 0.5).length / cover.length) * 100;
    console.log(`\n【真实 VS Code · ${label}】有效帧 ${valid.length}（光标宽 ${cw}px，高 ${diag.cursorSize.h}px）`);
    console.log(`  前缘分离 caretX-maxX : 均值 ${f1(F.m)}px  P95 ${f1(F.p95)}px  最大 ${f1(F.mx)}px  （正=分离）`);
    console.log(`  覆盖光标像素          : 均值 ${f1(C.m)}/${cw}px   有重叠帧占比 ${coverRate.toFixed(0)}%`);
    console.log(`  后缘滞后 caretX-minX : 均值 ${f1(T.m)}px  P95 ${f1(T.p95)}px`);
    console.log(`  形状总宽度            : 均值 ${f1(W.m)}px`);
    const dts = [];
    for (let i = 1; i < valid.length; i++) dts.push(valid[i].t - valid[i - 1].t);
    const DT = st(dts);
    if (DT) console.log(`  探针帧间隔            : 均值 ${f1(DT.m)}ms（约 ${(1000 / Math.max(DT.m, 1)).toFixed(0)}fps）`);
    // 目标值（style.left）vs 实际渲染位置（rect.left）：检测光标插值/平滑动画
    const withStyle = valid.filter((f) => f.styleX != null);
    if (withStyle.length) {
      const diffs = withStyle.map((f) => f.caretX - f.styleX); // 实际 − 目标
      const D = st(diffs);
      console.log(`  光标 实际−目标(style)  : 均值 ${f1(D.m)}px  P95 ${f1(D.p95)}px  最大 ${f1(D.mx)}px（≠0 ⇒ 存在插值动画）`);
    }
    // 停止后拖尾收敛：形状宽度回到 ≤2px 所需时间 —— 直接量化"拖尾消失快慢"
    const stopAt = await page.evaluate(() => window.__stoppedAt || 0);
    if (stopAt) {
      const after = valid.filter((f) => f.t >= stopAt && f.maxX != null).sort((a, b) => a.t - b.t);
      let conv = null, maxW = 0;
      for (const f of after) {
        maxW = Math.max(maxW, f.maxX - f.minX);
        if (f.maxX - f.minX <= 2) { conv = f.t - stopAt; break; }
      }
      console.log(`  停止后拖尾收敛        : ${conv == null ? "> 采样窗口" : conv.toFixed(0) + "ms"}（停止时残留拖尾宽 ${f1(maxW)}px → 收回 ≤2px 的用时）`);
    }
  }

  await sampleStats("键盘快速输入（33ms/字符）");

  // 11b. 场景：按住方向键 →（真实 key repeat：CDP autoRepeat，无 keyup；先到行尾以触发跨行移动）
  console.log("\n⌨️  按住方向键 →（真实 autoRepeat，含跨行移动）…");
  await page.keyboard.press("End"); // 先到行尾
  await sleep(150);
  await page.evaluate(() => { window.__real.length = 0; });
  const cdp = await page.context().newCDPSession(page);
  const key = { windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39, code: "ArrowRight", key: "ArrowRight" };
  await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key, autoRepeat: false });
  for (let i = 0; i < 40; i++) {
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...key, autoRepeat: true });
    await sleep(33);
  }
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
  await page.evaluate(() => { window.__stoppedAt = performance.now(); });
  await sleep(400);
  await sampleStats("按住方向键 →（autoRepeat 含跨行）");

  // 12. 场景 2：按住左键乱晃（拖动选择）
  console.log("\n🖱️  按住左键乱晃 ~1.5s…");
  const edBox = await page.evaluate(() => {
    const r = document.querySelector(".monaco-editor").getBoundingClientRect();
    const c = document.querySelector(".monaco-editor .cursor").getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: c.left + 1, cy: c.top + 9 };
  });
  await page.evaluate(() => { window.__real.length = 0; window.__stoppedAt = 0; });
  // 同步即时性验证：在 mousemove 事件的同一 JS 任务里读光标 DOM 位置，
  // 与鼠标事件坐标对比 → 判断"滞后"是我们脚本的同步延迟，还是 VS Code 本身的延迟
  await page.evaluate(() => {
    window.__mouseSync = [];
    window.addEventListener("mousemove", (e) => {
      const el = document.querySelector(".monaco-editor .cursor");
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 我们脚本"已知"的光标位置（上次 syncCursors 记录的值）
      let scriptX = null;
      const mgr = window.__ncMgr;
      if (mgr) {
        for (const [el2, d] of mgr.cursors) {
          if (el2 === el) { scriptX = d.lastX; break; }
        }
      }
      window.__mouseSync.push({ t: performance.now(), mx: e.clientX, cx: r.left, sx: scriptX });
    }, true);
  });
  await page.mouse.move(edBox.cx, edBox.cy);
  await page.mouse.down();
  let mx = edBox.cx, my = edBox.cy;
  for (let i = 0; i < 90; i++) {
    mx += (Math.random() * 2 - 1) * 40;
    my += (Math.random() * 2 - 1) * 16;
    mx = Math.max(edBox.l + 20, Math.min(edBox.r - 20, mx));
    my = Math.max(edBox.t + 20, Math.min(edBox.b - 20, my));
    await page.mouse.move(mx, my);
    await sleep(16);
  }
  await page.mouse.up();
  await page.evaluate(() => { window.__stoppedAt = performance.now(); });
  await sleep(400);
  await sampleStats("按住左键乱晃（拖动选择）");

  // 同步即时性统计：区分"VS Code 自身延迟"与"我们脚本的帧内同步延迟"
  {
    const msync = await page.evaluate(() => (window.__mouseSync || []).slice());
    const withScript = msync.filter((s) => s.sx != null);
    if (withScript.length) {
      const dVsMouse = withScript.map((s) => Math.abs(s.cx - s.mx));
      const dVsScript = withScript.map((s) => Math.abs(s.cx - s.sx));
      const A = st(dVsMouse), B = st(dVsScript);
      console.log(`\n同步即时性（mousemove 事件同一任务内读取，样本 ${withScript.length}）:`);
      console.log(`  |光标DOM位置 - 鼠标位置|      : 均值 ${f1(A.m)}px  P95 ${f1(A.p95)}px  （VS Code 更新光标的即时性）`);
      console.log(`  |光标DOM位置 - 脚本已知位置|  : 均值 ${f1(B.m)}px  P95 ${f1(B.p95)}px  （我们脚本的同步延迟）`);
    }
  }

  // 13. 内部状态抽查（乱晃后，取分离最大帧）
  {
    const valid = await page.evaluate(() => window.__real.filter((f) => f.n > 0 && f.dbg && !f.dbg.err && f.maxX != null).slice());
    if (valid.length) {
      const byGap = valid.slice().sort((a, b) => (b.caretX - b.maxX) - (a.caretX - a.maxX));
      const picks = [byGap[0], byGap[1]].filter(Boolean);
      console.log(`\n===== 内部状态（乱晃，分离最大的帧）=====`);
      for (const f of picks) {
        const d = f.dbg;
        console.log(`t=${f.t.toFixed(0)} caretX=${f.caretX.toFixed(1)} maxX=${f.maxX} 分离=${(f.caretX - f.maxX).toFixed(1)}px | move#=${d.mv} dest=(${d.dest})`);
        for (const c of d.cn) {
          console.log(`  角 rp=(${c.rp})  cp=(${c.cp})  τ=${c.ax[2].toFixed(4)}  pos=${c.ax[0]}`);
        }
      }
    }
  }

  // 12. 截图（输入进行中抓一张，看形态）
  const shot = process.env.SHOT;
  if (shot) {
    const clip = await page.evaluate(() => {
      const el = document.querySelector(".monaco-editor .cursor");
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left - 220), y: Math.max(0, r.top - 40), width: 400, height: 110 };
    });
    const shotP = page.screenshot({ path: shot, clip });
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("a");
      await sleep(33);
    }
    await shotP;
    console.log(`\n截图已保存: ${shot}`);
  }

  console.log("\n关闭测试实例…");
  cleanup();
  process.exit(0);
})().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
