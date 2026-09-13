// Neovide Cursor Injector 核心逻辑（v1.2.0）
//
// 纯 Node 实现，不依赖 vscode 模块 —— 便于本地测试，并同时适用于 VS Code / Cursor
// （两者都是 Electron 版 VS Code 衍生品，注入原理一致）。
//
// 原理：新版 VS Code 系产品（含 Cursor）的 CSP 禁用了内联脚本（script-src 无
// 'unsafe-inline'），导致 Custom CSS and JS Loader 的内联 <script> 注入被拦截。
// 而外部同源脚本 <script src="./neovide-cursor.js"> 被 CSP 'self' 放行，
// 因此直接把 neovide-cursor.js 复制到 workbench 目录并在 workbench.html 中
// 追加一行 script 标签即可生效，全程无需 Custom CSS Loader。
//
// v1.2.0 适配要点：
//  1. 路径探测支持 electron-sandbox（Cursor 全系 + 新版 VS Code）与
//     electron-browser（旧版 VS Code）两种目录结构
//  2. 注入后同步 product.json 中 workbench.html 的 SHA256 校验值，消除
//     "安装已损坏"（installation appears to be corrupt）横幅 —— 算法：
//     SHA256 → base64 → 去掉末尾 '='，与 VS Code / Cursor 的校验实现一致

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============ 常量 ============
const MARKER = "<!-- Neovide Cursor 光标动画注入 -->";
const JS_FILENAME = "neovide-cursor.js";

// workbench.html 候选相对路径（相对安装根目录或 resources/app）
//  - electron-sandbox：Cursor 全系 / 新版 VS Code
//  - electron-browser：旧版 VS Code
const WORKBENCH_RELS = [
	path.join("out", "vs", "code", "electron-sandbox", "workbench", "workbench.html"),
	path.join("out", "vs", "code", "electron-browser", "workbench", "workbench.html"),
];

// ============ 日志（由宿主注入实现，核心层不关心写到哪里） ============
let writeLog = () => {};

function setLogger(fn) {
	writeLog = typeof fn === "function" ? fn : () => {};
}

// ============ 工具 ============
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 计算文件校验值：SHA256 → base64 → 去 padding（与 VS Code/Cursor 校验实现一致） */
function fileChecksum(filePath) {
	return crypto
		.createHash("sha256")
		.update(fs.readFileSync(filePath)) // 不带编码 = 按字节读取
		.digest("base64")
		.replace(/=+$/, "");
}

/**
 * 定位 workbench.html。
 * 兼容多种安装结构：
 *  - 标准安装:  <install>/resources/app/out/...
 *  - zip/hash:  <install>/<hash>/resources/app/out/...
 *  - Cursor:    同为 zip/hash 式，但目录名为 electron-sandbox
 * 通过 appRoot（宿主 API）与 process.execPath 双路探测。
 *
 * @param {string} [appRoot] vscode.env.appRoot（由宿主传入；测试时可省略）
 * @returns {string|null} workbench.html 的绝对路径
 */
function findWorkbenchHtml(appRoot) {
	const dirs = new Set();

	// 路 1：宿主提供的 appRoot（VS Code / Cursor 均支持该 API）
	if (appRoot) {
		dirs.add(appRoot);
		dirs.add(path.dirname(appRoot));
		dirs.add(path.resolve(appRoot, "..", ".."));
	}

	// 路 2：从可执行文件所在目录出发
	try {
		const exeDir = path.dirname(process.execPath);
		dirs.add(exeDir);
		dirs.add(path.join(exeDir, "resources"));
		// 一级子目录（zip 版的 hash 目录，如 e4c7e7b1d6 / 08d4889f9e）
		for (const entry of fs.readdirSync(exeDir, { withFileTypes: true })) {
			if (entry.isDirectory()) dirs.add(path.join(exeDir, entry.name));
		}
	} catch (e) {
		// 读不到 exe 目录时忽略，靠 appRoot 兜底
	}

	// 对每个候选目录尝试 [dir, dir/resources/app] × 各候选相对路径
	for (const dir of dirs) {
		for (const base of [dir, path.join(dir, "resources", "app")]) {
			for (const rel of WORKBENCH_RELS) {
				const htmlPath = path.join(base, rel);
				try {
					if (fs.existsSync(htmlPath)) return htmlPath;
				} catch (e) {
					// 无权限等异常，跳过
				}
			}
		}
	}
	return null;
}

/**
 * 同步 product.json 中 workbench.html 的 SHA256 校验值（幂等）。
 *
 * 产品启动时会根据 product.json 的 checksums 字段校验若干关键文件，
 * 修改 workbench.html 后若不更新该值，会弹出"安装已损坏"横幅。
 * 本函数只做字符串级的最小替换，product.json 的其余内容与格式原样保留。
 *
 * @returns {{status: string, msg?: string}}
 *   updated = 已同步 | already = 本来就是对的 | skip = 无对应条目 | error = 异常
 */
function syncChecksum(htmlPath) {
	// 自下而上寻找 product.json 所在目录（即 resources/app 目录）
	let appDir = path.dirname(htmlPath);
	for (let i = 0; i < 6 && !fs.existsSync(path.join(appDir, "product.json")); i++) {
		appDir = path.dirname(appDir);
	}
	const prodPath = path.join(appDir, "product.json");
	if (!fs.existsSync(prodPath)) return { status: "skip", msg: "未找到 product.json" };

	// checksums 的 key 是相对 out 目录的 POSIX 风格路径，如
	// "vs/code/electron-sandbox/workbench/workbench.html"
	const key = path.relative(path.join(appDir, "out"), htmlPath).replace(/\\/g, "/");

	try {
		const prodText = fs.readFileSync(prodPath, "utf-8");
		// 不用 JSON.parse，直接正则定位条目 —— 对 BOM / 格式差异更稳健
		const re = new RegExp(`("${escapeRegExp(key)}"\\s*:\\s*")([^"]*)(")`);
		const m = prodText.match(re);
		if (!m) return { status: "skip", msg: `checksums 无 ${key} 条目` };

		const hash = fileChecksum(htmlPath);
		if (m[2] === hash) return { status: "already", msg: "校验值已一致" };

		// 仅首次备份（固定后缀，不随时间戳堆积）
		const bak = prodPath + ".bak-neovide";
		if (!fs.existsSync(bak)) fs.copyFileSync(prodPath, bak);

		// 替换字符串必须用 $1 + 新值 + $3：
		// $1 = 组(键 + 冒号 + 开引号)，$2 = 旧值（丢弃），$3 = 闭合引号
		fs.writeFileSync(prodPath, prodText.replace(re, `$1${hash}$3`), "utf-8");
		return { status: "updated", msg: `${m[2].slice(0, 8)}… → ${hash.slice(0, 8)}…` };
	} catch (e) {
		return { status: "error", msg: e.message };
	}
}

/**
 * 执行注入（幂等）。
 *
 * @param {{extensionPath: string, appRoot?: string}} opts
 * @returns {{status: string, msg?: string, htmlPath?: string,
 *            checksum?: string, checksumMsg?: string}}
 *   status: 'injected' 本次完成注入 | 'already' 已注入过 | 'error' 失败
 */
function inject(opts) {
	const htmlPath = findWorkbenchHtml(opts.appRoot);
	if (!htmlPath) return { status: "error", msg: "未找到 workbench.html" };

	const wbDir = path.dirname(htmlPath);
	const jsSrc = path.join(opts.extensionPath, "assets", JS_FILENAME);
	const jsDest = path.join(wbDir, JS_FILENAME);

	try {
		// 1. 复制动画脚本到 workbench 目录（始终覆盖，保证与扩展内版本一致）
		fs.copyFileSync(jsSrc, jsDest);

		// 2. 读取 workbench.html
		let html = fs.readFileSync(htmlPath, "utf-8");

		let injected = false;
		if (!html.includes(MARKER)) {
			// 3. 备份原始文件（带时间戳）
			const stamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.slice(0, 19);
			fs.copyFileSync(htmlPath, path.join(wbDir, `workbench.html.bak-${stamp}`));

			// 4. 在 </html> 前追加 script 标签
			//    注意：放在 <script src="./workbench.js"> 之后，此时 body 已解析，document.body 可用
			const scriptTag = `\n\t${MARKER}\n\t<script src="./${JS_FILENAME}"></script>\n`;
			html = html.replace("</html>", scriptTag + "</html>");
			fs.writeFileSync(htmlPath, html, "utf-8");
			injected = true;
		}

		// 5. 同步 product.json 校验值（无论本次是否新注入都执行，保证最终一致；
		//    旧版本扩展注入过的安装升级到 v1.2.0 后，也会在这里补上同步）
		const ck = syncChecksum(htmlPath);

		return {
			status: injected ? "injected" : "already",
			htmlPath,
			checksum: ck.status,
			checksumMsg: ck.msg,
		};
	} catch (e) {
		return { status: "error", msg: e.message, htmlPath };
	}
}

module.exports = { inject, findWorkbenchHtml, syncChecksum, fileChecksum, setLogger, MARKER };
