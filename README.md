# ✨ Neocursor Fix

> **Neovide 风格光标动画注入器（修复版）** / **Neovide-style cursor animation injector (fixed version)**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

Neovide 风格的光标弹性动画，无需 Custom CSS Loader，安装 VSIX 即用，**支持 VS Code 与 Cursor**，编辑器更新后自动重新注入。

A Neovide-style cursor animation for **VS Code and Cursor**. No Custom CSS Loader needed — install the VSIX and you're done. Auto-reinjects after editor updates.

---

## 🩹 为什么要修复 / Why this fix

原插件（[vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)）已停止维护。新版 VS Code 的 CSP（Content Security Policy）禁用了内联脚本（`script-src` 无 `'unsafe-inline'`），导致原方案（Custom CSS Loader 注入内联 `<script>`）被拦截，光标动画失效。

The original extension ([vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)) is no longer maintained. Newer VS Code versions block inline scripts via CSP (no `'unsafe-inline'` in `script-src`), which breaks the original approach of injecting inline `<script>` tags through Custom CSS Loader.

**修复方案**：外部同源脚本 `<script src="./neovide-cursor.js">` 被 CSP `'self'` 放行。本扩展在启动时直接把动画脚本复制到 workbench 目录，并在 `workbench.html` 中追加一行 script 标签——无需任何额外工具，全程自动。

**The fix**: same-origin external scripts (`<script src="./neovide-cursor.js">`) are allowed by CSP `'self'`. On activation, this extension copies the animation script into the workbench directory and appends a script tag to `workbench.html` — no extra tools, fully automatic.

| 特性 / Feature | 原版 / Original | 本修复版 / This fix |
|---|---|---|
| 需要 Custom CSS Loader | ✅ | ❌ 不需要 / Not needed |
| 兼容新版 VS Code CSP | ❌ 失效 / Broken | ✅ |
| 安装方式 / Install | 手动配置 `vscode_custom_css.imports` | 安装 VSIX 即用 / Install & use |
| 更新后自动重注入 / After update | 需手动重新注入 / Manual | ✅ 自动重新注入 / Auto reinject |
| Cursor 支持 / Cursor support | ❌ | ✅ |
| "安装已损坏"提示 / "Corrupted" banner | 会出现 / Shown | ❌ v1.2.0 起自动同步校验值 / Auto-synced since v1.2.0 |

---

## 🚀 快速开始 / Quick Start

1. 从 [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases) 下载最新 `neovide-cursor-injector-1.2.7.vsix`
2. 安装扩展：
   - VS Code / Cursor：命令面板执行 `Extensions: Install from VSIX...` 选择该文件
   - 或命令行：`cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **完全重启编辑器**（不是 Reload Window）
4. 完成！打字时即可看到弹性光标动画

1. Download the latest `neovide-cursor-injector-1.2.7.vsix` from [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases).
2. Install it:
   - VS Code / Cursor: run `Extensions: Install from VSIX...` and pick the file
   - Or via CLI: `cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **Fully restart the editor** (not Reload Window).
4. Done! You'll see the elastic cursor animation while typing.

---

## ⚙️ 自定义配置 / Configuration

1. 命令面板（`Ctrl+Shift+P`）执行 `Neovide Cursor: 重新注入光标动画` / Run `Neovide Cursor: Reinject Cursor Animation` from the command palette
2. 修改扩展目录下 `assets/neovide-cursor.js` 顶部的参数 / Edit parameters at the top of `assets/neovide-cursor.js` in the extension directory:
   - `tailColor`：光标颜色（默认粉色 `#FFC0CB`）/ cursor color (default pink `#FFC0CB`)
   - `useShadow`：辉光开关 / glow toggle
   - `animationLength`：动画速度 / animation speed
   - `cursorDisappearDelay`：光标消失延迟 / cursor disappear delay
3. 保存后重新执行注入命令，重启生效 / Save, re-run the reinject command, then restart.

覆盖主题光标颜色（可选）/ Override theme cursor color (optional):

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ 常见问题 / FAQ

### Q: 提示"安装已损坏"？/ "Installation appears to be corrupted"?
A: v1.2.0 起不再出现——注入后会自动同步产品校验值（`product.json` 的 `checksums`）。旧版扩展留下的提示点"不再提示"即可，不影响任何功能。
A: Since v1.2.0 this no longer appears — the extension syncs the product checksum (`product.json` → `checksums`) after injecting. If an older version left the banner, click "Don't show again". It doesn't affect any functionality.

> ⚠️ **请注意（排查编辑器异常时）**：由于校验值已被同步，编辑器**不会提示安装目录被本扩展修改**。
> 判断注入是否生效的两个标志：安装目录下存在 `neovide-cursor.js` 与 `workbench.html.bak-*` 备份。
> 完全恢复原状 = 删除注入的 script 标签 + 还原备份文件 + 卸载扩展。
>
> ⚠️ **Note (when troubleshooting the editor)**: since the checksum is synced, the editor will
> **not** warn that its install directory was modified. Two indicators that injection is active:
> the presence of `neovide-cursor.js` and a `workbench.html.bak-*` backup in the workbench
> directory. To fully revert: remove the injected script tag, restore the backup, uninstall.

### Q: 编辑器更新后动画没了？/ Animation missing after an update?
A: 不用管，扩展会在下次启动时自动重新注入（含更新器覆盖竞态的延时复核兜底）。
A: Don't worry — the extension reinjects automatically on next startup (with delayed re-checks to cover update-overwrite races).

### Q: 安装了但没效果？/ Installed but no effect?
A: 请检查 / Please check:
1. 是否**完全退出**了编辑器再重新打开（注入需重启生效）/ Did you **fully quit** the editor and reopen it? (injection needs a restart)
2. 若装在 `Program Files` 等受保护目录，请以**管理员身份**运行一次 / If installed in a protected directory like `Program Files`, run the editor as **administrator** once.
3. 查看 `injector.log`（扩展安装目录的父目录下），里面有每轮检测/注入记录 / Check `injector.log` (in the parent directory of the extension install folder) for per-run detect/inject records.

### Q: 如何卸载？/ How to uninstall?
A: 卸载扩展前，先把 `workbench.html` 还原（删除注入的两行 + 删除 `neovide-cursor.js`），再卸载扩展。文件位于（两者其一；同目录下有注入前的 `workbench.html.bak-*` 时间戳备份可直接改回）：
- Cursor / 新版 VS Code：`<安装目录>/resources/app/out/vs/code/electron-sandbox/workbench/`
- 旧版 VS Code：`<安装目录>/resources/app/out/vs/code/electron-browser/workbench/`

A: Before uninstalling, restore `workbench.html` (remove the two injected lines + delete `neovide-cursor.js`), then uninstall. Files live in one of (a pre-injection `workbench.html.bak-*` backup is available in the same directory):
- Cursor / newer VS Code: `<install dir>/resources/app/out/vs/code/electron-sandbox/workbench/`
- Older VS Code: `<install dir>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ 性能提示：动画会带来一定性能负担与电量消耗，建议插电使用。
> ⚠️ Performance: the animation costs some performance and battery. Plug in your laptop.

---

## 📝 更新日志 / Changelog

### v1.2.7
- 🐛 **前缘瞬时贴合（不改动拖尾时长）**：修复快速连续输入（按住 `a`、方向键）时
  "拖尾跟不上光标 / 两个光标"的观感——前角（移动方向上的角点）的吸附时长 0.02s
  在每次光标跳变后留下约 5px 的持续滞后，而真实光标仅约 2px 宽，形状前缘因此
  脱离光标本体。现在前角吸附时长 = 0（对任意帧率恒为瞬时贴合），**尾巴的长度与
  弹性仍由其余角点的 0.05 / 0.1 时长决定，完全不受影响**。
  实测（sim 固定场景，2px 光标）：前缘分离 P95 各场景全部归零（keyRepeat/乱晃/
  快速移动从 0 / 1.1 / 6.0px → -1.0 / -0.4 / -1.0px）；快速移动拖尾宽度
  98.6px → **103.2px**（略增，因为前角不再"占用"形状前半）。真实 Cursor 环境
  验证：快速输入下前缘分离恒定 -1.0px、100% 帧覆盖光标本体。
- 与 v1.2.5 的区别：那次置 0 时该参数还兼任"快速移动收缩"公式的下限（该公式已在
  v1.2.6 整体移除），导致整条拖尾消失；现在它是纯粹的前角吸附时长，无第二重身份。

<details>
<summary>v1.2.7 (English)</summary>

- 🐛 **Instant leading-edge snap (without touching trail durations)**: fixed the
  "trail can't keep up / two cursors" look during fast repeated typing (holding `a`
  or arrow keys). The leading corners' 0.02s snap left a persistent ~5px lag after
  each caret jump, and real carets are only ~2px wide, so the shape's leading edge
  detached from the caret body. The leading snap duration is now 0 (instant snap at
  any frame rate) while **the tail's length and elasticity still come entirely from
  the other corners' 0.05 / 0.1 durations — unaffected**.
  Measured (fixed sim scene, 2px caret): leading-edge separation P95 dropped to
  -1.0 / -0.4 / -1.0px across scenes (from 0 / 1.1 / 6.0px); fast-move trail width
  98.6px → **103.2px** (slightly longer). Verified on real Cursor: leading-edge
  separation constant -1.0px with 100% caret coverage during fast typing.
- Difference from v1.2.5: back then the 0 also zeroed the floor of the
  "fast-move shrink" formula (removed entirely in v1.2.6), killing the whole
  trail; the parameter is now purely the leading snap duration.
</details>

### v1.2.6
- ⏪ **回退 v1.2.4 / v1.2.5 的动画时长改动，恢复 v1.2.0 的时长体系**（拖尾速度以 v1.2.0 为准）：
  - 移除 v1.2.4 的「速度自适应」——它让**移动越远、拖尾时长越短**（与 v1.2.0 的
    「远距离使用更长的 animationLength（0.1s）」正好相反），且距离阈值按"光标宽度的
    倍数"计算：真实光标仅约 2px 宽，**移动 16px 即触发收缩**，实际观感反而丢掉拖尾。
  - 撤销 v1.2.5 的「前缘瞬时贴合」——该改动本意是消除快速输入时前缘约 5px 的滞后，
    但它同时把「快速移动收缩」公式的下限置为了 0，导致快速移动时拖尾瞬间消失
    （实测反馈：「拖尾怎么这么快，还没看到就消失了」）。
- 现在：短距离 0.05s / 远距离 0.1s / 吸附角 0.02s（均为 v1.2.0 原值），快速移动与
  拖动时重新有清晰、持久、可见的长拖尾。
- 实测（sim 固定场景，2px 光标，形状总宽度 = 拖尾可见度）——快速移动场景：
  **v1.2.0 基准 142.6px / v1.2.5 仅 8.7px / v1.2.6 恢复至 98.5px**（同量级）。
- v1.2.1~v1.2.3 的性能重构、事件源补全、原生光标保留等改动**全部保留**。

<details>
<summary>v1.2.6 (English)</summary>

- ⏪ **Reverted the v1.2.4/v1.2.5 animation-duration changes; restored the v1.2.0 duration
  system** (the reference for trail speed):
  - Removed v1.2.4's "speed adaptation" — it made the trail **shorter the farther you moved**
    (the opposite of v1.2.0, where long moves use the longer `animationLength` of 0.1s), and
    its distance threshold is measured in *cursor widths*: real carets are only ~2px wide, so
    **any move over 16px triggered the shrink**, which in practice just killed the trail.
  - Undid v1.2.5's "instant leading-edge snap" — intended to remove the leading edge's ~5px
    lag during fast typing, but it also zeroed the floor of the shrink formula, making the
    trail vanish instantly on fast movement (user feedback: "the trail is gone before I can
    even see it").
- Now: short moves 0.05s / long moves 0.1s / snapping corners 0.02s (all v1.2.0 values);
  fast movement and dragging produce a clear, persistent, visible long trail again.
- Measured (fixed sim scene, 2px caret, shape width = trail visibility) — fast-move scene:
  **v1.2.0 baseline 142.6px / v1.2.5 only 8.7px / v1.2.6 restored to 98.5px** (same order).
- All v1.2.1–v1.2.3 changes (performance rework, event sources, native cursor) are kept.
</details>

### v1.2.5
- 🐛 修复**快速连续输入（按住键不放）时拖尾与光标"分家"、看起来像两个光标**的问题：
  此前"前缘角点"（移动方向上的角点）的吸附时长为 0.02s，而每输入一个字符、光标跳变
  之后，弹簧在一帧内只能衰减约三成——留下约 5px 的持续滞后。真实光标仅约 2px 宽，
  形状前缘因此脱离光标本体，观感上就是"两个光标"。现改为**瞬时贴合**（吸附时长 0，
  对任意帧率恒生效）：形状前缘始终贴住光标，尾巴形态与弹性由其余角点产生，不受影响。
  实测（真实 VS Code + CDP 逐帧像素测量）：快速输入下"形状与光标有重叠的帧"占比
  **68% → 99%**；按住左键乱晃下 **89% → 96%**，前缘分离 P95 从持续 22px 降至
  -1px（覆盖），只剩光标跳变瞬间的单帧同步瞬态（浏览器事件循环的理论下限）。

<details>
<summary>v1.2.5 (English)</summary>

- 🐛 Fixed the trail "splitting away" from the caret during fast repeated typing
  (holding a key down), which looked like two cursors. The leading corners' snap
  duration was 0.02s, and after each caret jump the spring decayed only ~30% within
  one frame, leaving a persistent ~5px lag. Real carets are only ~2px wide, so the
  shape's leading edge detached from the caret body. Now the leading edge snaps
  **instantly** (snap duration 0, frame-rate independent), while the tail shape and
  elasticity still come from the trailing corners.
  Measured on real VS Code via CDP frame-level pixel sampling: frames where the shape
  overlaps the caret went **68% → 99%** during fast typing and **89% → 96%** while
  swinging with the left button held; leading-edge separation P95 dropped from a
  persistent 22px to -1px (covering), leaving only single-frame sync transients
  (the browser event-loop floor).
</details>

### v1.2.4
- 🐛 修复**快速移动 / 拖动乱晃时拖尾"追不上"光标**的问题：拖尾滞后 = 移动速度 × 弹簧
  时间常数，速度越快甩得越远（实测极端乱晃下滞后可达 350~600px，拖尾变成被甩开的色块）。
  新增**速度自适应**：弹簧时长随移动距离反比收缩（下限为吸附时长）——快速移动时拖尾
  主动收敛、紧贴光标；打字与慢速移动保持原有的丝滑拖尾不变。
  实测（12px/帧随机换向的乱晃模拟）：滞后从 ~350px 降至 **0px**。
- 🔧 位置读取优化：改用 `style.left/top` + 定位祖先换算（不再依赖 `getBoundingClientRect`），
  不受光标 CSS 过渡插值影响。

<details>
<summary>v1.2.4 (English)</summary>

- 🐛 Fixed the trail "can't keep up" during fast movement / mouse swinging: trail lag
  equals speed × spring time-constant, so faster movement throws the trail further
  behind (350–600px in extreme swings). Added **speed adaptation**: the spring duration
  now shrinks inversely with movement distance (floored at the snap duration) — the
  trail converges onto the cursor during fast movement, while typing/slow movement
  keeps the original silky trail. Measured with a 12px/frame random-direction swing:
  lag dropped from ~350px to **0px**.
- 🔧 Position reading now uses `style.left/top` + positioned-ancestor math instead of
  `getBoundingClientRect()`, immune to CSS-transition interpolation.
</details>

### v1.2.3
- 🐛 修复快速移动/拖动时的"跟随延迟感"：v1.2.1 修复 `target` 字段后首次真正启用了
  「隐藏原生光标」逻辑，使跟随完全依赖物理引擎（弹簧动画固有约 0.1s 滞后，实测快速
  移动时光标头落后目标 74px）。现回退为默认**保留原生光标**（精确跟随）+ canvas 叠加
  拖尾——这也是历史版本因该字段缺失而**事实上长期验证过**的观感。
  需要"纯净 Neovide 模式"（原生光标隐去）可将 `hideNativeCursor` 手动设为 `true`。

<details>
<summary>v1.2.3 (English)</summary>

- 🐛 Fixed the "following lag" during fast movement / dragging: v1.2.1's fix of the
  `target` field enabled native-cursor hiding for the first time, leaving following
  entirely to the physics engine (inherent ~0.1s spring lag; measured 74px behind the
  target during fast movement). Now defaults back to **keeping the native cursor**
  (precise following) + canvas trail overlay — the behavior that was in fact
  experienced for a long time (the hiding logic never ran before due to that field).
  For a "pure Neovide mode" set `hideNativeCursor: true` manually.
</details>

### v1.2.2
- 🐛 修复**拖动选择**（按住鼠标拖动）时跟随延迟高、拖尾消失、出现"两个光标"的问题：
  拖动时光标跟随鼠标移动但不触发键盘/选择事件，导致 v1.2.1 的事件脏标记缺位、动画停更。
  现将 `mousemove` 纳入脏标记事件源（置位为 O(1) 成本，DOM 读取仍在帧内消费、每帧至多一次）。

<details>
<summary>v1.2.2 (English)</summary>

- 🐛 Fixed high latency, lost trails, and "two cursors" when drag-selecting with the
  mouse held down: the caret follows the mouse without emitting key/selection events,
  so the v1.2.1 dirty flag was never set. `mousemove` is now a dirty-flag source
  (O(1) cost; actual DOM reads still happen at most once per frame).
</details>

### v1.2.1
- 🐛 **修复渲染进程崩溃问题**：重构动画脚本的 DOM 监听与渲染循环 —— 旧版用
  MutationObserver 全量监听 + 渲染循环内每帧强制布局读取，在宿主高负载场景
  （如 VS Code 更新后的启动洪流）可能把渲染进程拖入崩溃循环
  - 移除全量 MutationObserver，改为「事件脏标记 + 400ms 低频兜底扫描」
  - 渲染帧内不再读取 DOM（位置使用扫描阶段缓存），消除每帧强制布局
  - **延迟启动**（页面 load 后 1.5s）：避开宿主启动期的 DOM 洪流（崩溃循环的直接诱因）
  - 页面切后台时暂停渲染循环；单帧异常不再终止整个循环
  - 修复 `target` 字段缺失导致「隐藏原生光标」逻辑从未生效的 Bug
    （如需保留旧版实际行为，可将 `hideNativeCursor` 设为 `false`）
  - 光标实例数量上限保护（防异常场景下无限增长）

<details>
<summary>v1.2.1 (English)</summary>

- 🐛 **Fixed renderer-process crashes**: reworked the animation script's DOM
  observing and render loop (crash analysis and fix notes included)
  - Removed the full-tree MutationObserver; now uses event dirty-flags + a
    400ms low-frequency fallback scan
  - Zero DOM reads inside the render frame (positions are cached during scans)
  - **Delayed startup** (1.5s after page load) to avoid the host's startup DOM
    flood — the direct trigger of the crash loop
  - Render loop pauses when the page is hidden; a single-frame error no longer
    kills the whole loop
  - Fixed the missing `target` field that silently disabled native-cursor hiding
    (set `hideNativeCursor: false` to keep the old actual behavior)
  - Cursor-instance cap as a self-protection measure
</details>

### v1.2.0
- ✅ 新增 **Cursor 支持**（自动探测 `electron-sandbox` 目录结构）
- ✅ 注入后自动同步 `product.json` 校验值，不再出现"安装已损坏"提示（VS Code 同样受益）
- ✅ 提示语按产品名动态显示（Cursor 里不再显示 "VS Code"）
- 🔧 核心逻辑抽离为 `injector-core.js`，新增本地验证脚本

### v1.2.0 (English)
- ✅ **Cursor support** (auto-detects the `electron-sandbox` layout)
- ✅ Syncs the `product.json` checksum after injecting — no more "corrupted installation" banner (also benefits VS Code)
- ✅ Dynamic product name in notifications (no more "VS Code" shown inside Cursor)
- 🔧 Core logic extracted to `injector-core.js`, with a local verification script

### v1.1.0
- ✅ 延时复核（10s/40s），解决更新覆盖注入的竞态问题 / Delayed re-checks (10s/40s) to survive update-overwrite races
- ✅ 完整行为日志 `injector.log` / Full activity log

### v1.0.0
- 🎉 首个版本：CSP 兼容的外部脚本注入方案 / Initial release: CSP-compatible external-script injection

---

## 🛠️ 自行打包 / Build from source

```bash
npx @vscode/vsce package
```

本地验证（在临时目录构造迷你安装结构，零副作用）/ Local verification (builds a mini install layout in a temp dir, zero side effects):

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 许可证与致谢 / License & Credits

本修复版以 **GPL-3.0** 许可发布，源自以下项目，感谢各位作者：

This fixed version is released under **GPL-3.0**, derived from the following projects. Many thanks to all the authors:

| 角色 / Role | 项目 / Project |
|---|---|
| 原作者 / Original author | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| 上游维护版 / Upstream maintained fork | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| 动画脚本来源 / Animation script origin | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| 原视频 / Original video (Bilibili) | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| 稀土掘金原帖 / Original article (Juejin) | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> 本项目为社区修复版本，与原项目无直接关联。如有问题请在 [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues) 反馈。
> This is a community-fixed version, not directly affiliated with the original projects. Issues are welcome at [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues).
