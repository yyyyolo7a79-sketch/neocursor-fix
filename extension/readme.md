# ✨ Neovide Cursor Injector

Neovide 风格光标动画自动注入器 —— 无需 Custom CSS Loader，安装即用。

![效果预览](https://raw.githubusercontent.com/30d98f9b2/Neovide-Cursor/refs/heads/main/gifs/basicAnimation.gif)

## 🚀 使用方法

1. 安装扩展：`Extensions: Install from VSIX...` 选择 `.vsix` 文件
2. **完全重启 VS Code**（不是 Reload Window）
3. 完成！打字时即可看到弹性光标动画

## ⚙️ 自定义配置

1. 命令面板（`Ctrl+Shift+P`）执行 `Neovide Cursor: 重新注入光标动画`
2. 修改扩展目录下 `assets/neovide-cursor.js` 顶部的参数（颜色、速度、辉光等）：
   - `tailColor`：光标颜色（默认粉色 `#FFC0CB`）
   - `useShadow`：辉光开关
   - `animationLength`：动画速度
   - `cursorDisappearDelay`：光标消失延迟
3. 保存后重新执行注入命令，重启 VS Code 生效

## ❓ 常见问题

### Q: 重启后 VS Code 提示"已损坏"？
A: 正常现象。本扩展会修改 VS Code 内部文件（workbench.html）来注入动画，
这是此类插件的通用做法。点击"不再提示"即可，不影响任何功能。

### Q: VS Code 更新后动画没了？
A: 不用管，扩展会在下次启动时自动重新注入。

### Q: 安装了但没效果？
A: 请检查：
1. 是否**完全退出**了 VS Code 再重新打开（注入需重启生效）
2. 若 VS Code 装在 Program Files 等受保护目录，请以**管理员身份**运行 VS Code 一次
3. 扩展是否会弹出错误提示（若有，把提示内容告诉我）

### Q: 如何卸载？
A: 卸载扩展前，先把 `workbench.html` 还原（删除注入的两行 + 删除
`neovide-cursor.js`），再卸载扩展。文件位于：
`<VS Code 安装目录>/resources/app/out/vs/code/electron-browser/workbench/`

## 📃 许可证

GPL-3.0-only。动画脚本源自 [vision-smash-code](https://github.com/Jenlybein/vision-smash-code)，
项目源自 [Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor)。

> ⚠️ 性能提示：动画会带来一定性能负担与电量消耗，建议插电使用。
