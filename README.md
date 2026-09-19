<div align="center">

**Language / 语言 / 語言 / 言語 / 언어**

[**English**](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](docs/zh-TW/README.md) | [日本語](docs/ja-JP/README.md) | [한국어](docs/ko-KR/README.md)

</div>

---

# ✨ Neocursor Fix

> A Neovide-style elastic cursor animation for **VS Code and Cursor** — no Custom CSS Loader needed. Install the VSIX and you're done. Auto-reinjects after editor updates.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/yyyyolo7a79-sketch/neocursor-fix)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)

---

## 🩹 Why this fix

The original extension ([vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)) is no longer maintained. Newer VS Code versions block inline scripts via CSP (no `'unsafe-inline'` in `script-src`), which breaks the original approach of injecting inline `<script>` tags through Custom CSS Loader.

**The fix**: same-origin external scripts (`<script src="./neovide-cursor.js">`) are allowed by CSP `'self'`. On activation, this extension copies the animation script into the workbench directory and appends a script tag to `workbench.html` — no extra tools, fully automatic.

| Feature | Original | This fix |
|---|---|---|
| Needs Custom CSS Loader | ✅ | ❌ Not needed |
| Compatible with new VS Code CSP | ❌ Broken | ✅ |
| Installation | Manual `vscode_custom_css.imports` setup | Install the VSIX and go |
| After editor update | Manual re-inject | ✅ Auto re-inject |
| Cursor support | ❌ | ✅ |
| "Corrupted installation" banner | Shown | ❌ Auto-synced checksum since v1.2.0 |

---

## 🚀 Quick Start

1. Download the latest `neovide-cursor-injector-1.2.7.vsix` from [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases).
2. Install it:
   - VS Code / Cursor: run `Extensions: Install from VSIX...` and pick the file
   - Or via CLI: `cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **Fully restart the editor** (not Reload Window).
4. Done! You'll see the elastic cursor animation while typing.

---

## ⚙️ Configuration

1. Run `Neovide Cursor: Reinject Cursor Animation` from the command palette (`Ctrl+Shift+P`).
2. Edit parameters at the top of `assets/neovide-cursor.js` in the extension directory:
   - `tailColor` — cursor color (default pink `#FFC0CB`)
   - `useShadow` — glow toggle
   - `animationLength` — animation speed
   - `cursorDisappearDelay` — cursor disappear delay
3. Save, re-run the reinject command, then restart.

Override the theme cursor color (optional):

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ FAQ

### Q: "Installation appears to be corrupted"?
A: Since v1.2.0 this no longer appears — the extension syncs the product checksum (`product.json` → `checksums`) after injecting. If an older version left the banner, click "Don't show again". It doesn't affect any functionality.

> ⚠️ **Note (when troubleshooting the editor)**: since the checksum is synced, the editor will
> **not** warn that its install directory was modified. Two indicators that injection is active:
> the presence of `neovide-cursor.js` and a `workbench.html.bak-*` backup in the workbench
> directory. To fully revert: remove the injected script tag, restore the backup, uninstall.

### Q: Animation missing after an editor update?
A: Don't worry — the extension reinjects automatically on next startup (with delayed re-checks to cover update-overwrite races).

### Q: Installed but no effect?
A: Please check:
1. Did you **fully quit** the editor and reopen it? (injection needs a restart)
2. If installed in a protected directory like `Program Files`, run the editor as **administrator** once.
3. Check `injector.log` (in the parent directory of the extension install folder) for per-run detect/inject records.

### Q: How to uninstall?
A: Before uninstalling, restore `workbench.html` (remove the two injected lines + delete `neovide-cursor.js`), then uninstall. Files live in one of (a pre-injection `workbench.html.bak-*` backup is available in the same directory):
- Cursor / newer VS Code: `<install dir>/resources/app/out/vs/code/electron-sandbox/workbench/`
- Older VS Code: `<install dir>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ Performance: the animation costs some performance and battery. Plug in your laptop.

---

## 📝 Changelog

### v1.2.7
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

### v1.2.6
- ⏪ **Reverted the v1.2.4/v1.2.5 animation-duration changes; restored the v1.2.0 duration
  system** (the reference for trail speed):
  - Removed v1.2.4's "speed adaptation" — it made the trail **shorter the farther you moved**
    (the opposite of v1.2.0, where long moves use the longer `animationLength` of 0.1s), and
    its distance threshold is measured in *cursor widths*: real carets are only ~2px wide, so
    **any move over 16px triggered the shrink**, which in practice just killed the trail.
  - Undid v1.2.5's "instant leading-edge snap" — intended to remove the leading edge's ~5px
    lag during fast typing, but it also zeroed the floor of the shrink formula, making the
    trail vanish instantly on fast movement.
- Now: short moves 0.05s / long moves 0.1s / snapping corners 0.02s (all v1.2.0 values);
  fast movement and dragging produce a clear, persistent, visible long trail again.
- Measured (fixed sim scene, 2px caret, shape width = trail visibility) — fast-move scene:
  **v1.2.0 baseline 142.6px / v1.2.5 only 8.7px / v1.2.6 restored to 98.5px** (same order).
- All v1.2.1–v1.2.3 changes (performance rework, event sources, native cursor) are kept.

### v1.2.5
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

<details>
<summary>v1.2.4 — older versions</summary>

### v1.2.4
- 🐛 Fixed the trail "can't keep up" during fast movement / mouse swinging (superseded
  by v1.2.6 — the duration system was restored to the v1.2.0 baseline).
- 🔧 Position reading now uses `style.left/top` + positioned-ancestor math instead of
  `getBoundingClientRect()`, immune to CSS-transition interpolation.

### v1.2.3
- 🐛 Fixed the "following lag" during fast movement / dragging: v1.2.1's fix of the
  `target` field enabled native-cursor hiding for the first time, leaving following
  entirely to the physics engine (inherent ~0.1s spring lag). Now defaults back to
  **keeping the native cursor** (precise following) + canvas trail overlay.
  For a "pure Neovide mode" set `hideNativeCursor: true` manually.

### v1.2.2
- 🐛 Fixed high latency, lost trails, and "two cursors" when drag-selecting with the
  mouse held down: `mousemove` is now a dirty-flag source (O(1) cost; actual DOM reads
  still happen at most once per frame).

### v1.2.1
- 🐛 **Fixed renderer-process crashes**: reworked the animation script's DOM observing
  and render loop
  - Removed the full-tree MutationObserver; now uses event dirty-flags + a 400ms
    low-frequency fallback scan
  - Zero DOM reads inside the render frame (positions are cached during scans)
  - **Delayed startup** (1.5s after page load) to avoid the host's startup DOM flood
  - Render loop pauses when the page is hidden; a single-frame error no longer kills
    the whole loop
  - Fixed the missing `target` field that silently disabled native-cursor hiding
  - Cursor-instance cap as a self-protection measure

### v1.2.0
- ✅ **Cursor support** (auto-detects the `electron-sandbox` layout)
- ✅ Syncs the `product.json` checksum after injecting — no more "corrupted installation"
  banner (also benefits VS Code)
- ✅ Dynamic product name in notifications (no more "VS Code" shown inside Cursor)
- 🔧 Core logic extracted to `injector-core.js`, with a local verification script

### v1.1.0
- ✅ Delayed re-checks (10s/40s) to survive update-overwrite races
- ✅ Full activity log (`injector.log`)

### v1.0.0
- 🎉 Initial release: CSP-compatible external-script injection

</details>

---

## 🛠️ Build from source

```bash
npx @vscode/vsce package
```

Local verification (builds a mini install layout in a temp dir, zero side effects):

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 License & Credits

This fixed version is released under **GPL-3.0**, derived from the following projects. Many thanks to all the authors:

| Role | Project |
|---|---|
| Original author | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| Upstream maintained fork | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| Animation script origin | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| Original video (Bilibili) | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| Original article (Juejin) | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> This is a community-fixed version, not directly affiliated with the original projects. Issues are welcome at [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues).
