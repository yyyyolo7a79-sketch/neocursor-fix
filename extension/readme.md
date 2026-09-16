# ✨ Neovide Cursor Injector

Neovide 风格光标动画自动注入器 —— 无需 Custom CSS Loader，安装即用。
支持 **VS Code** 与 **Cursor**（自动识别，无需额外配置）。

![效果预览](https://raw.githubusercontent.com/30d98f9b2/Neovide-Cursor/refs/heads/main/gifs/basicAnimation.gif)

## 🚀 使用方法

1. 安装扩展：`Extensions: Install from VSIX...` 选择 `.vsix` 文件
   （Cursor 也可用命令行：`cursor --install-extension xxx.vsix`）
2. **完全重启**（不是 Reload Window）
3. 完成！打字时即可看到弹性光标动画

## ⚙️ 自定义配置

1. 命令面板（`Ctrl+Shift+P`）执行 `Neovide Cursor: 重新注入光标动画`
2. 修改扩展目录下 `assets/neovide-cursor.js` 顶部的参数（颜色、速度、辉光等）：
   - `tailColor`：光标颜色（默认粉色 `#FFC0CB`）
   - `useShadow`：辉光开关
   - `animationLength`：动画速度
   - `cursorDisappearDelay`：光标消失延迟
3. 保存后重新执行注入命令，重启生效

## ❓ 常见问题

### Q: 编辑器更新后动画没了？
A: 不用管，扩展会在下次启动时自动重新注入（含更新器覆盖的竞态兜底）。

### Q: v1.2.1 修复了什么？
A: 修复了动画脚本在宿主高负载场景（如编辑器更新后的启动期）可能导致渲染进程崩溃的问题：
移除了全量 DOM 监听（改为事件驱动 + 低频兜底扫描）、渲染帧内零 DOM 读取、延迟启动避开
启动洪流、后台自动暂停。另外修复了"隐藏原生光标"逻辑从未生效的 Bug（效果会更接近
Neovide：原生光标由 canvas 动画光标接管，可用 `hideNativeCursor` 配置切换）。

### Q: 提示"安装已损坏"？
A: v1.2.0 起不再出现——注入后会自动同步产品的校验值。
旧版扩展留下的该提示点"不再提示"即可，不影响任何功能。

### Q: 安装了但没效果？
A: 请检查：
1. 是否**完全退出**后再重新打开（注入需重启生效）
2. 若装在 `Program Files` 等受保护目录，请以**管理员身份**运行一次
3. 查看 `injector.log`（扩展安装目录的父目录下），里面有每轮检测/注入记录

### Q: 如何卸载？
A: 先还原 `workbench.html`（删除注入的两行 + 删除 `neovide-cursor.js`），再卸载扩展。
文件位于安装目录下（两者其一）：
- Cursor / 新版 VS Code：`resources/app/out/vs/code/electron-sandbox/workbench/`
- 旧版 VS Code：`resources/app/out/vs/code/electron-browser/workbench/`

同目录下留有注入前的 `workbench.html.bak-*` 时间戳备份，可直接改回。

## 📃 许可证

GPL-3.0-only。动画脚本源自 [vision-smash-code](https://github.com/Jenlybein/vision-smash-code)，
项目源自 [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor)。

> ⚠️ 性能提示：动画会带来一定性能负担与电量消耗，建议插电使用。
