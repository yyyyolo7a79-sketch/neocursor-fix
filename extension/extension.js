// Neovide Cursor Injector —— 自动注入扩展
//
// 原理：新版 VS Code 的 CSP 禁用了内联脚本（script-src 无 'unsafe-inline'），
// 导致 Custom CSS and JS Loader 的内联 <script> 注入被拦截、光标动画失效。
// 而外部同源脚本 <script src="./neovide-cursor.js"> 被 CSP 'self' 放行，
// 因此本扩展直接把 neovide-cursor.js 复制到 workbench 目录并在 workbench.html
// 中追加一行 script 标签即可生效，全程无需 Custom CSS Loader。
//
// 行为：
//  1. 启动时自动检测注入状态：未注入 → 自动注入 + 提示重启；已注入 → 静默跳过
//  2. VS Code 更新后（out 目录被覆盖）再次启动时自动重新注入
//  3. 提供命令 "Neovide Cursor: 重新注入光标动画" 手动触发

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

// ============ 常量 ============
const MARKER = "<!-- Neovide Cursor 光标动画注入 -->";
const JS_FILENAME = "neovide-cursor.js";
const REL_WORKBENCH = path.join(
	"out", "vs", "code", "electron-browser", "workbench", "workbench.html",
);

/**
 * 定位 workbench.html。
 * 兼容多种安装结构：
 *  - 标准安装:  <install>/resources/app/out/...
 *  - zip/hash:  <install>/<hash>/resources/app/out/...
 *  - 便携版:    同上
 * 通过 vscode.env.appRoot 与 process.execPath 双路探测。
 */
function findWorkbenchHtml() {
	const rel = REL_WORKBENCH;
	const dirs = new Set();

	// 路 1：appRoot（VS Code 官方 API，指向 resources/app 或带 hash 的 app 目录）
	if (vscode.env.appRoot) {
		dirs.add(vscode.env.appRoot);
		dirs.add(path.dirname(vscode.env.appRoot));
		dirs.add(path.resolve(vscode.env.appRoot, "..", ".."));
	}

	// 路 2：从 Code.exe 所在目录出发
	try {
		const exeDir = path.dirname(process.execPath);
		dirs.add(exeDir);
		dirs.add(path.join(exeDir, "resources"));
		// 一级子目录（zip 版的 hash 目录，如 e4c7e7b1d6）
		for (const entry of fs.readdirSync(exeDir, { withFileTypes: true })) {
			if (entry.isDirectory()) dirs.add(path.join(exeDir, entry.name));
		}
	} catch (e) {
		// 读不到 exe 目录时忽略，靠 appRoot 兜底
	}

	// 对每个候选目录尝试 [dir, dir/resources/app] 两种拼接
	for (const dir of dirs) {
		for (const base of [dir, path.join(dir, "resources", "app")]) {
			const htmlPath = path.join(base, rel);
			try {
				if (fs.existsSync(htmlPath)) return htmlPath;
			} catch (e) {
				// 无权限等异常，跳过
			}
		}
	}
	return null;
}

/**
 * 执行注入（幂等）。
 * @returns {string} 'injected' | 'already' | 'error'
 */
function inject(context) {
	const htmlPath = findWorkbenchHtml();
	if (!htmlPath) return { status: "error", msg: "未找到 workbench.html" };

	const wbDir = path.dirname(htmlPath);
	const jsSrc = path.join(context.extensionPath, "assets", JS_FILENAME);
	const jsDest = path.join(wbDir, JS_FILENAME);

	try {
		// 1. 复制动画脚本到 workbench 目录（覆盖式，保证与扩展内版本一致）
		fs.copyFileSync(jsSrc, jsDest);

		// 2. 读取 workbench.html
		let html = fs.readFileSync(htmlPath, "utf-8");

		// 3. 幂等检查：已注入则跳过
		if (html.includes(MARKER)) return { status: "already" };

		// 4. 备份原始文件（带时间戳）
		const stamp = new Date()
			.toISOString()
			.replace(/[:.]/g, "-")
			.slice(0, 19);
		fs.copyFileSync(htmlPath, path.join(wbDir, `workbench.html.bak-${stamp}`));

		// 5. 在 </html> 前追加 script 标签
		//    注意：放在 <script src="./workbench.js"> 之后，此时 body 已解析，document.body 可用
		const scriptTag = `\n\t${MARKER}\n\t<script src="./${JS_FILENAME}"></script>\n`;
		html = html.replace("</html>", scriptTag + "</html>");
		fs.writeFileSync(htmlPath, html, "utf-8");

		return { status: "injected" };
	} catch (e) {
		return { status: "error", msg: e.message };
	}
}

/**
 * 激活入口
 */
function activate(context) {
	// 自动注入
	const result = inject(context);
	if (result.status === "injected") {
		vscode.window.showInformationMessage(
			"✨ Neovide Cursor 已注入！请完全重启 VS Code 查看效果（若提示'已损坏'，点'不再提示'即可）",
		);
	} else if (result.status === "error") {
		vscode.window.showErrorMessage(
			`❌ Neovide Cursor 注入失败：${result.msg}` +
				(result.msg.includes("EACCES") || result.msg.includes("EPERM")
					? "（权限不足，请以管理员身份运行 VS Code 一次）"
					: ""),
		);
	}
	// 'already' 状态静默跳过

	// 手动重新注入命令
	const cmd = vscode.commands.registerCommand(
		"neovideCursorInject.reinject",
		async () => {
			const r = inject(context);
			if (r.status === "injected") {
				await vscode.window.showInformationMessage(
					"✨ 注入完成！请完全重启 VS Code 生效",
				);
			} else if (r.status === "already") {
				await vscode.window.showInformationMessage(
					"⏭️ 已注入过，无需重复操作。若修改了配置，重启 VS Code 即可生效",
				);
			} else {
				await vscode.window.showErrorMessage(
					`❌ 注入失败：${r.msg}`,
				);
			}
		},
	);
	context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
