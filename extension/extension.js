// Neovide Cursor Injector —— 自动注入扩展（v1.2.0）
//
// 支持 VS Code 与 Cursor（均为 Electron 版 VS Code 衍生，注入原理一致）。
// 核心注入逻辑见 injector-core.js；本文件只负责 vscode 宿主相关部分：
// 激活时机、用户提示、复核定时器、手动命令、日志文件。
//
// 行为：
//  1. 启动时自动检测注入状态：未注入 → 自动注入 + 提示重启；已注入 → 静默跳过
//  2. 编辑器更新后（out 目录被覆盖）再次启动时自动重新注入
//  3. 延时复核（10s/40s）：更新器可能在扩展激活之后才替换文件，
//     复核兜底保证最终状态正确
//  4. 注入后同步 product.json 校验值（v1.2.0），不再出现"安装已损坏"横幅
//  5. 完整行为日志：写入扩展安装目录下的 injector.log，失效时可据此定位
//  6. 提供命令 "Neovide Cursor: 重新注入光标动画" 手动触发

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const core = require("./injector-core");

// 复核时间点（ms）：覆盖"更新器在扩展激活后才替换文件"的竞态窗口
const RECHECK_DELAYS = [10_000, 40_000];

// ============ 日志 ============
let logFile = null;

function initLog(ctx) {
	try {
		const dir = path.join(ctx.extensionPath, ".."); // 扩展安装区父目录（与扩展同级，可写）
		logFile = path.join(dir, "injector.log");
		writeLog("=== 扩展激活 ===");
	} catch (e) {
		logFile = null;
	}
}

function writeLog(msg) {
	if (!logFile) return;
	try {
		const ts = new Date().toISOString().slice(0, 19);
		fs.appendFileSync(logFile, `[${ts}] ${msg}\n`, "utf-8");
	} catch (e) {
		// 日志写失败不影响主流程
	}
}

/**
 * 激活入口
 */
function activate(context) {
	initLog(context);
	core.setLogger(writeLog);

	// 产品名（"Cursor" / "Visual Studio Code"），用于提示语与日志
	const appName = vscode.env.appName || "编辑器";
	writeLog(`宿主: ${appName}`);

	// 单次检测 + 处置，返回结果供报告/日志
	const runOnce = (isRecheck) => {
		const r = core.inject({
			extensionPath: context.extensionPath,
			appRoot: vscode.env.appRoot,
		});
		writeLog(
			`${isRecheck ? "[复核]" : "[首轮]"} inject(${r.status})` +
				(r.msg ? ` msg=${r.msg}` : "") +
				` checksum=${r.checksum || "-"}` +
				(r.checksumMsg ? `(${r.checksumMsg})` : "") +
				` html=${r.htmlPath || "未找到"}`,
		);
		return r;
	};

	const result = runOnce(false);
	if (result.status === "injected") {
		vscode.window.showInformationMessage(
			`✨ Neovide Cursor 已注入 ${appName}！请完全重启查看效果`,
		);
	} else if (result.status === "error") {
		vscode.window.showErrorMessage(
			`❌ Neovide Cursor 注入失败：${result.msg}` +
				(result.msg.includes("EACCES") || result.msg.includes("EPERM")
					? `（权限不足，请以管理员身份运行 ${appName} 一次）`
					: ""),
		);
	}
	// 'already' 状态静默跳过

	// 延时复核：更新器在扩展激活后才替换 out 目录时，
	// 首轮注入可能被覆盖，此处兜底重注入
	for (const delay of RECHECK_DELAYS) {
		setTimeout(() => {
			try {
				const r = runOnce(true);
				if (r.status === "injected") {
					vscode.window.showInformationMessage(
						`🔁 Neovide Cursor 自动复核：检测到更新覆盖，已重新注入！请重启 ${appName} 生效`,
					);
				}
			} catch (e) {
				writeLog(`复核异常: ${e.message}`);
			}
		}, delay);
	}

	// 手动重新注入命令
	const cmd = vscode.commands.registerCommand(
		"neovideCursorInject.reinject",
		async () => {
			const r = runOnce(false);
			if (r.status === "injected") {
				await vscode.window.showInformationMessage(
					`✨ 注入完成！请完全重启 ${appName} 生效`,
				);
			} else if (r.status === "already") {
				await vscode.window.showInformationMessage(
					`⏭️ 已注入过，无需重复操作。若修改了配置，重启 ${appName} 即可生效`,
				);
			} else {
				await vscode.window.showErrorMessage(`❌ 注入失败：${r.msg}`);
			}
		},
	);
	context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
