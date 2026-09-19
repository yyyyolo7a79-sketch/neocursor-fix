<div align="center">

**Language / 语言 / 語言 / 言語 / 언어**

[**English**](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](docs/zh-TW/README.md) | [日本語](docs/ja-JP/README.md) | [한국어](docs/ko-KR/README.md)

</div>

---

# ✨ Neocursor Fix

> Neovide 风格的光标弹性动画（社区修复版），支持 **VS Code 与 Cursor**。无需 Custom CSS Loader，安装 VSIX 即用，编辑器更新后自动重新注入。

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/yyyyolo7a79-sketch/neocursor-fix)](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases)

> 📄 此文件为精简翻译版；完整更新日志与最新内容以 [English README](README.md) 为准。

---

## 🩹 为什么要修复

原插件（[vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor)）已停止维护。新版 VS Code 的 CSP（Content Security Policy）禁用了内联脚本（`script-src` 无 `'unsafe-inline'`），导致原方案（Custom CSS Loader 注入内联 `<script>`）被拦截，光标动画失效。

**修复方案**：外部同源脚本 `<script src="./neovide-cursor.js">` 被 CSP `'self'` 放行。本扩展在启动时直接把动画脚本复制到 workbench 目录，并在 `workbench.html` 中追加一行 script 标签——无需任何额外工具，全程自动。

| 特性 | 原版 | 本修复版 |
|---|---|---|
| 需要 Custom CSS Loader | ✅ | ❌ 不需要 |
| 兼容新版 VS Code CSP | ❌ 失效 | ✅ |
| 安装方式 | 手动配置 `vscode_custom_css.imports` | 安装 VSIX 即用 |
| 更新后自动重注入 | 需手动重新注入 | ✅ 自动重新注入 |
| Cursor 支持 | ❌ | ✅ |
| "安装已损坏"提示 | 会出现 | ❌ v1.2.0 起自动同步校验值 |

---

## 🚀 快速开始

1. 从 [Releases](https://github.com/yyyyolo7a79-sketch/neocursor-fix/releases) 下载最新 `neovide-cursor-injector-1.2.7.vsix`
2. 安装扩展：
   - VS Code / Cursor：命令面板执行 `Extensions: Install from VSIX...` 选择该文件
   - 或命令行：`cursor --install-extension neovide-cursor-injector-1.2.7.vsix`
3. **完全重启编辑器**（不是 Reload Window）
4. 完成！打字时即可看到弹性光标动画

---

## ⚙️ 自定义配置

1. 命令面板（`Ctrl+Shift+P`）执行 `Neovide Cursor: 重新注入光标动画`
2. 修改扩展目录下 `assets/neovide-cursor.js` 顶部的参数：
   - `tailColor`：光标颜色（默认粉色 `#FFC0CB`）
   - `useShadow`：辉光开关
   - `animationLength`：动画速度
   - `cursorDisappearDelay`：光标消失延迟
3. 保存后重新执行注入命令，重启生效

覆盖主题光标颜色（可选）：

```json
"workbench.colorCustomizations": {
  "editorCursor.foreground": "#FFC0CB"
}
```

---

## ❓ 常见问题

### Q: 提示"安装已损坏"？
A: v1.2.0 起不再出现——注入后会自动同步产品校验值（`product.json` 的 `checksums`）。旧版扩展留下的提示点"不再提示"即可，不影响任何功能。

> ⚠️ **请注意（排查编辑器异常时）**：由于校验值已被同步，编辑器**不会提示安装目录被本扩展修改**。
> 判断注入是否生效的两个标志：安装目录下存在 `neovide-cursor.js` 与 `workbench.html.bak-*` 备份。
> 完全恢复原状 = 删除注入的 script 标签 + 还原备份文件 + 卸载扩展。

### Q: 编辑器更新后动画没了？
A: 不用管，扩展会在下次启动时自动重新注入（含更新器覆盖竞态的延时复核兜底）。

### Q: 安装了但没效果？
A: 请检查：
1. 是否**完全退出**了编辑器再重新打开（注入需重启生效）
2. 若装在 `Program Files` 等受保护目录，请以**管理员身份**运行一次
3. 查看 `injector.log`（扩展安装目录的父目录下），里面有每轮检测/注入记录

### Q: 如何卸载？
A: 卸载扩展前，先把 `workbench.html` 还原（删除注入的两行 + 删除 `neovide-cursor.js`），再卸载扩展。文件位于（两者其一；同目录下有注入前的 `workbench.html.bak-*` 时间戳备份可直接改回）：
- Cursor / 新版 VS Code：`<安装目录>/resources/app/out/vs/code/electron-sandbox/workbench/`
- 旧版 VS Code：`<安装目录>/resources/app/out/vs/code/electron-browser/workbench/`

> ⚠️ 性能提示：动画会带来一定性能负担与电量消耗，建议插电使用。

---

## 📝 更新日志（最近版本）

> 完整历史（v1.0.0 起）见 [English README](README.md#-changelog)。

### v1.2.7
- 🐛 **前缘瞬时贴合（不改动拖尾时长）**：修复快速连续输入（按住 `a`、方向键）时
  "拖尾跟不上光标 / 两个光标"的观感——前角（移动方向上的角点）的吸附时长 0.02s
  在每次光标跳变后留下约 5px 的持续滞后，而真实光标仅约 2px 宽，形状前缘因此
  脱离光标本体。现在前角吸附时长 = 0（对任意帧率恒为瞬时贴合），**尾巴的长度与
  弹性仍由其余角点的 0.05 / 0.1 时长决定，完全不受影响**。
  实测（sim 固定场景，2px 光标）：前缘分离 P95 各场景全部归零；快速移动拖尾宽度
  98.6px → **103.2px**（略增）。真实 Cursor 环境验证：快速输入下前缘分离恒定
  -1.0px、100% 帧覆盖光标本体。

### v1.2.6
- ⏪ **回退 v1.2.4 / v1.2.5 的动画时长改动，恢复 v1.2.0 的时长体系**（拖尾速度以
  v1.2.0 为准）：移除「速度自适应」（它让移动越远拖尾越短，与 v1.2.0 正相反），
  撤销 v1.2.5 的吸附时长置 0（它同时废掉了收缩下限，导致快速移动时拖尾瞬间消失）。
  现在：短距离 0.05s / 远距离 0.1s / 吸附角 0.02s（均为 v1.2.0 原值）。
  实测（2px 光标，形状宽度）：快速移动场景 v1.2.5 仅 8.7px → v1.2.6 恢复至 98.5px。

### v1.2.5
- 🐛 修复快速连续输入（按住键不放）时拖尾与光标"分家"、看起来像两个光标的问题：
  前缘角点吸附时长 0.02s 在每次光标跳变后留下约 5px 的持续滞后，现改为瞬时贴合
  （吸附时长 0，对任意帧率恒生效）。实测（真实 VS Code + CDP 逐帧像素测量）：
  快速输入下"形状与光标有重叠的帧"占比 68% → 99%。

---

## 🛠️ 自行打包

```bash
npx @vscode/vsce package
```

本地验证（在临时目录构造迷你安装结构，零副作用）：

```bash
node extension/test/manual-inject-test.js
```

---

## 📃 许可证与致谢

本修复版以 **GPL-3.0** 许可发布，源自以下项目，感谢各位作者：

| 角色 | 项目 |
|---|---|
| 原作者 | [vscode-neovide-cursor](https://github.com/LengineerC/vscode-neovide-cursor) |
| 上游维护版 | [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) |
| 动画脚本来源 | [vision-smash-code](https://github.com/Jenlybein/vision-smash-code) (GPL-3.0) |
| 原视频（Bilibili） | [BV1XtviBkEMr](https://www.bilibili.com/video/BV1XtviBkEMr/) |
| 稀土掘金原帖 | [稀土掘金帖子](https://juejin.cn/post/7578917474659352627) |

> 本项目为社区修复版本，与原项目无直接关联。如有问题请在 [Issues](https://github.com/yyyyolo7a79-sketch/neocursor-fix/issues) 反馈。
