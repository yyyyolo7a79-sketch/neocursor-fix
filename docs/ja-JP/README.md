<div align="center">

**Language / 语言 / 語言 / 言語 / 언어**

[**English**](../../README.md) | [简体中文](../../README.zh-CN.md) | [繁體中文](../zh-TW/README.md) | [日本語](README.md) | [한국어](../ko-KR/README.md)

</div>

---

# ✨ Neocursor Fix

> Neovide 風の弾性カーソルアニメーション（コミュニティ修正版）。**VS Code と Cursor** に対応。Custom CSS Loader 不要 — VSIX をインストールするだけで使えます。エディタ更新後も自動で再注入されます。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](../../LICENSE)
![VS Code](https://img.shields.io/badge/VS%20Code-1.80%2B-007ACC?logo=visualstudiocode&logoColor=white)
![Cursor](https://img.shields.io/badge/Cursor-supported-000000?logo=cursor&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)
[![Stars](https://img.shields.io/github/stars/yyyyolo7a79-sketch/neocursor-fix?style=flat)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/stargazers)
[![Downloads](https://img.shields.io/github/downloads/yyyyolo7a79-sketch/neocursor-fix/total?style=flat)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)
[![Latest release](https://img.shields.io/github/v/release/yyyyolo7a79-sketch/neocursor-fix)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)

> 📄 このファイルは簡易翻訳版です。完全な変更履歴と最新情報は [English README](../../README.md) を参照してください。

---

## 🩹 なぜ修正が必要か

オリジナルの拡張機能（[vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)）はメンテナンスが終了しています。新しい VS Code では CSP（Content Security Policy）によりインラインスクリプトがブロックされるため（`script-src` に `'unsafe-inline'` がない）、従来の方法（Custom CSS Loader によるインライン `<script>` の注入）は動作しません。

**修正方法**：同一オリジンの外部スクリプト `<script src="./neovide-cursor.js">` は CSP の `'self'` で許可されます。この拡張機能は起動時にアニメーションスクリプトを workbench ディレクトリへコピーし、`workbench.html` に script タグを 1 行追加します — 追加ツールは不要、すべて自動です。

| 機能 | オリジナル | 本修正版 |
|---|---|---|
| Custom CSS Loader が必要 | ✅ | ❌ 不要 |
| 新しい VS Code の CSP に対応 | ❌ 動作しない | ✅ |
| インストール方法 | `vscode_custom_css.imports` を手動設定 | VSIX をインストールするだけ |
| エディタ更新後 | 手動で再注入 | ✅ 自動で再注入 |
| Cursor 対応 | ❌ | ✅ |
| 「インストールが破損しています」表示 | 表示される | ❌ v1.2.0 以降はチェックサムを自動同期 |

---

## 🚀 クイックスタート

1. [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases) から最新の `neovide-cursor-injector-1.2.7.vsix` をダウンロード
2. インストール：
   - VS Code / Cursor：コマンドパレットで `Extensions: Install from VSIX...` を実行し、ファイルを選択
   - または CLI：`cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **エディタを完全に再起動**（Reload Window ではなく）
4. 完了！タイピング時に弾性カーソルアニメーションが表示されます

---

## ⚙️ カスタマイズ

1. コマンドパレット（`Ctrl+Shift+P`）で `Neovide Cursor: 重新注入光标动画` を実行
2. 拡張機能ディレクトリの `assets/neovide-cursor.js` 冒頭のパラメータを編集：
   - `tailColor`：カーソルの色（デフォルトはピンク `#FFC0CB`）
   - `useShadow`：グロー（発光）のオン/オフ
   - `animationLength`：アニメーション速度
   - `cursorDisappearDelay`：カーソルが消えるまでの遅延
3. 保存後に再注入コマンドを実行し、再起動すると反映されます

テーマのカーソル色を上書き（任意）：

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ FAQ

### Q: 「インストールが破損しています」と表示される？
A: v1.2.0 以降は表示されません — 注入後に製品チェックサム（`product.json` の `checksums`）を自動同期します。古いバージョンの拡張機能が残した表示は「今後表示しない」をクリックしてください。機能には影響しません。

> ⚠️ **注意（エディタの不具合を調査する際）**：チェックサムが同期されているため、エディタはインストールディレクトリが変更されたことを**警告しません**。
> 注入が有効かどうかの確認方法：インストールディレクトリに `neovide-cursor.js` と `workbench.html.bak-*` バックアップが存在するか。
> 完全に元に戻す = 注入した script タグの削除 + バックアップの復元 + 拡張機能のアンインストール。

### Q: エディタ更新後にアニメーションが消えた？
A: そのままで問題ありません。次回起動時に自動で再注入されます（更新プログラムによる上書き競合に対する遅延再チェック付き）。

### Q: インストールしたが効果がない？
A: 以下を確認してください：
1. エディタを**完全に終了**してから再度開きましたか？（注入には再起動が必要です）
2. `Program Files` などの保護されたディレクトリにインストールしている場合は、一度**管理者として**実行してください
3. `injector.log`（拡張機能インストールフォルダの親ディレクトリ）を確認してください。各回の検出/注入の記録があります

### Q: アンインストール方法は？
A: 拡張機能をアンインストールする前に、`workbench.html` を復元（注入した 2 行を削除 + `neovide-cursor.js` を削除）してからアンインストールしてください。ファイルの場所（いずれか。同ディレクトリに注入前の `workbench.html.bak-*` タイムスタンプバックアップがあります）：
- Cursor / 新しい VS Code：`<インストール先>/resources/app/out/vs/code/electron-sandbox/workbench/`
- 古い VS Code：`<インストール先>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ パフォーマンス：アニメーションは多少のパフォーマンス負荷と電力消費があります。電源に接続しての使用をおすすめします。

---

## 📝 変更履歴（最近のバージョン）

> v1.0.0 からの完全な履歴は [English README](../../README.md#-changelog) を参照してください。

### v1.2.7
- 🐛 **先端の瞬時スナップ（トレイルの持続時間は変更なし）**：高速な連続入力（`a` や
  矢印キーの長押し）時の「トレイルがカーソルに追いつかない / カーソルが 2 つに見える」
  問題を修正。先端コーナー（移動方向側の角）のスナップ時間 0.02s が、カーソルの
  ジャンプごとに約 5px の持続的な遅れを残していました。実際のカーソルは幅約 2px の
  ため、図形の前端がカーソル本体から離れて見えていました。先端のスナップ時間を
  0（どのフレームレートでも瞬時にスナップ）に変更。**トレイルの長さと弾性は残りの
  コーナーの 0.05 / 0.1 の時間で決まり、影響はありません**。
  実測（sim 固定シーン、2px カーソル）：前端の分離 P95 はすべてのシーンでゼロ；
  高速移動時のトレイル幅 98.6px → **103.2px**（やや増加）。実機 Cursor で検証：
  高速入力時の前端分離は常に -1.0px、100% のフレームでカーソル本体をカバー。

### v1.2.6
- ⏪ **v1.2.4 / v1.2.5 の持続時間の変更を撤回し、v1.2.0 の持続時間体系を復元**
  （トレイル速度の基準は v1.2.0）：「速度適応」を削除（移動が遠いほどトレイルが
  短くなる、v1.2.0 と逆の挙動でした）。v1.2.5 のスナップ時間 0 も撤回（収縮の下限を
  同時に無効化し、高速移動時にトレイルが瞬時に消えていました）。
  現在：短距離 0.05s / 長距離 0.1s / スナップ角 0.02s（すべて v1.2.0 の元の値）。
  実測（2px カーソル、図形幅）：高速移動シーンで v1.2.5 はわずか 8.7px → v1.2.6 で 98.5px に回復。

### v1.2.5
- 🐛 高速な連続入力（キーの長押し）時にトレイルとカーソルが「分離」し、カーソルが
  2 つに見える問題を修正：前端コーナーのスナップ時間 0.02s がカーソルのジャンプごとに
  約 5px の持続的な遅れを残していました。瞬時スナップ（スナップ時間 0、どのフレーム
  レートでも有効）に変更。実測（実機 VS Code + CDP フレーム単位のピクセル計測）：
  高速入力時に「図形とカーソルが重なっているフレーム」の割合が 68% → 99%。

---

## 🛠️ ソースからビルド

```bash
npx @vscode/vsce package
```

ローカル検証（一時ディレクトリにミニインストール構造を作成、副作用ゼロ）：

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 ライセンスとクレジット

本修正版は **GPL-3.0** で公開されています。以下のプロジェクトに由来します。作者の皆様に感謝します：

| 役割 | プロジェクト |
|---|---|
| 原作者 | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| 上流メンテナンス版 | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| アニメーションスクリプトの出典 | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| 元動画（Bilibili） | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| 元記事（Juejin） | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> 本プロジェクトはコミュニティによる修正版であり、元プロジェクトとは直接関係ありません。問題は [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues) までお寄せください。
