<div align="center">

**Language / 语言 / 語言 / 言語 / 언어**

[**English**](../../README.md) | [简体中文](../../README.zh-CN.md) | [繁體中文](README.md) | [日本語](../ja-JP/README.md) | [한국어](../ko-KR/README.md)

</div>

---

# ✨ Neocursor Fix

> Neovide 風格的游標彈性動畫（社群修復版），支援 **VS Code 與 Cursor**。無需 Custom CSS Loader，安裝 VSIX 即可使用，編輯器更新後自動重新注入。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](../../LICENSE)
[![Latest release](https://img.shields.io/github/v/release/yyyyolo7a79-sketch/neocursor-fix)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)

> 📄 此檔案為精簡翻譯版；完整更新日誌與最新內容以 [English README](../../README.md) 為準。

---

## 🩹 為什麼需要修復

原外掛（[vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)）已停止維護。新版 VS Code 的 CSP（Content Security Policy）停用了內嵌指令碼（`script-src` 無 `'unsafe-inline'`），導致原方案（Custom CSS Loader 注入內嵌 `<script>`）被攔截，游標動畫失效。

**修復方案**：外部同源指令碼 `<script src="./neovide-cursor.js">` 被 CSP `'self'` 放行。本擴充功能在啟動時直接把動畫指令碼複製到 workbench 目錄，並在 `workbench.html` 中附加一行 script 標籤——無需任何額外工具，全程自動。

| 特性 | 原版 | 本修復版 |
|---|---|---|
| 需要 Custom CSS Loader | ✅ | ❌ 不需要 |
| 相容新版 VS Code CSP | ❌ 失效 | ✅ |
| 安裝方式 | 手動設定 `vscode_custom_css.imports` | 安裝 VSIX 即用 |
| 更新後自動重新注入 | 需手動重新注入 | ✅ 自動重新注入 |
| Cursor 支援 | ❌ | ✅ |
| 「安裝已損毀」提示 | 會出現 | ❌ v1.2.0 起自動同步校驗值 |

---

## 🚀 快速開始

1. 從 [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases) 下載最新 `neovide-cursor-injector-1.2.7.vsix`
2. 安裝擴充功能：
   - VS Code / Cursor：命令面板執行 `Extensions: Install from VSIX...` 選擇該檔案
   - 或命令列：`cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **完全重新啟動編輯器**（不是 Reload Window）
4. 完成！打字時即可看到彈性游標動畫

---

## ⚙️ 自訂設定

1. 命令面板（`Ctrl+Shift+P`）執行 `Neovide Cursor: 重新注入光标动画`
2. 修改擴充功能目錄下 `assets/neovide-cursor.js` 頂部的參數：
   - `tailColor`：游標顏色（預設粉色 `#FFC0CB`）
   - `useShadow`：輝光開關
   - `animationLength`：動畫速度
   - `cursorDisappearDelay`：游標消失延遲
3. 儲存後重新執行注入命令，重新啟動後生效

覆寫主題游標顏色（選用）：

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ 常見問題

### Q: 提示「安裝已損毀」？
A: v1.2.0 起不再出現——注入後會自動同步產品校驗值（`product.json` 的 `checksums`）。舊版擴充功能留下的提示點「不再提示」即可，不影響任何功能。

> ⚠️ **請注意（排查編輯器異常時）**：由於校驗值已被同步，編輯器**不會提示安裝目錄被本擴充功能修改**。
> 判斷注入是否生效的兩個標誌：安裝目錄下存在 `neovide-cursor.js` 與 `workbench.html.bak-*` 備份。
> 完全恢復原狀 = 刪除注入的 script 標籤 + 還原備份檔案 + 解除安裝擴充功能。

### Q: 編輯器更新後動畫不見了？
A: 不用管，擴充功能會在下次啟動時自動重新注入（含更新程式覆蓋競態的延時複核機制）。

### Q: 安裝了但沒效果？
A: 請檢查：
1. 是否**完全結束**編輯器再重新開啟（注入需重新啟動才生效）
2. 若安裝在 `Program Files` 等受保護目錄，請以**系統管理員身分**執行一次
3. 查看 `injector.log`（擴充功能安裝目錄的父目錄下），裡面有每輪偵測/注入紀錄

### Q: 如何解除安裝？
A: 解除安裝擴充功能前，先把 `workbench.html` 還原（刪除注入的兩行 + 刪除 `neovide-cursor.js`），再解除安裝。檔案位於（兩者其一；同目錄下有注入前的 `workbench.html.bak-*` 時間戳備份可直接改回）：
- Cursor / 新版 VS Code：`<安裝目錄>/resources/app/out/vs/code/electron-sandbox/workbench/`
- 舊版 VS Code：`<安裝目錄>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ 效能提示：動畫會帶來一定效能負擔與耗電，建議插電使用。

---

## 📝 更新日誌（近期版本）

> 完整歷史（v1.0.0 起）見 [English README](../../README.md#-changelog)。

### v1.2.7
- 🐛 **前緣瞬時貼合（不改動拖尾時長）**：修復快速連續輸入（按住 `a`、方向鍵）時
  「拖尾跟不上游標 / 兩個游標」的觀感——前角（移動方向上的角點）的吸附時長 0.02s
  在每次游標跳變後留下約 5px 的持續延遲，而真實游標僅約 2px 寬，形狀前緣因此
  脫離游標本體。現在前角吸附時長 = 0（對任意幀率恆為瞬時貼合），**尾巴的長度與
  彈性仍由其餘角點的 0.05 / 0.1 時長決定，完全不受影響**。
  實測（sim 固定場景，2px 游標）：前緣分離 P95 各場景全部歸零；快速移動拖尾寬度
  98.6px → **103.2px**（略增）。真實 Cursor 環境驗證：快速輸入下前緣分離恆定
  -1.0px、100% 幀覆蓋游標本體。

### v1.2.6
- ⏪ **回退 v1.2.4 / v1.2.5 的動畫時長改動，恢復 v1.2.0 的時長體系**（拖尾速度以
  v1.2.0 為準）：移除「速度自適應」（它讓移動越遠拖尾越短，與 v1.2.0 正相反），
  撤銷 v1.2.5 的吸附時長置 0（它同時廢掉了收縮下限，導致快速移動時拖尾瞬間消失）。
  現在：短距離 0.05s / 遠距離 0.1s / 吸附角 0.02s（均為 v1.2.0 原值）。
  實測（2px 游標，形狀寬度）：快速移動場景 v1.2.5 僅 8.7px → v1.2.6 恢復至 98.5px。

### v1.2.5
- 🐛 修復快速連續輸入（按住鍵不放）時拖尾與游標「分家」、看起來像兩個游標的問題：
  前緣角點吸附時長 0.02s 在每次游標跳變後留下約 5px 的持續延遲，現改為瞬時貼合
  （吸附時長 0，對任意幀率恆生效）。實測（真實 VS Code + CDP 逐幀像素測量）：
  快速輸入下「形狀與游標有重疊的幀」佔比 68% → 99%。

---

## 🛠️ 自行打包

```bash
npx @vscode/vsce package
```

本機驗證（在臨時目錄建構迷你安裝結構，零副作用）：

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 授權與致謝

本修復版以 **GPL-3.0** 授權發布，源自以下專案，感謝各位作者：

| 角色 | 專案 |
|---|---|
| 原作者 | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| 上游維護版 | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| 動畫指令碼來源 | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| 原影片（Bilibili） | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| 稀土掘金原文 | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> 本專案為社群修復版本，與原專案無直接關聯。如有問題請在 [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues) 回報。
