// 本地验证脚本（不随 vsix 发布，见 .vscodeignore）
//
// 在临时目录构造"迷你安装结构"（复制真实安装的 workbench.html + product.json），
// 用真实文件验证 v1.2.0 的：路径探测 / 注入 / 校验值同步 / 幂等性 / 迁移场景。
// 不触碰真实安装目录，零副作用。
//
// 用法: node test/manual-inject-test.js

const fs = require("fs");
const path = require("path");
const os = require("os");
const core = require("../injector-core");

const EXT_DIR = path.resolve(__dirname, "..");
const results = [];

function check(cond, label) {
	results.push({ ok: !!cond, label });
	console.log(`  ${cond ? "✅" : "❌"} ${label}`);
}

/** 在安装根目录下探测 workbench.html 相对路径（out/vs/code/electron-sandbox 或 electron-browser） */
function probeVariant(appDir) {
	for (const v of ["electron-sandbox", "electron-browser"]) {
		const rel = path.join("out", "vs", "code", v, "workbench", "workbench.html");
		if (fs.existsSync(path.join(appDir, rel))) return rel;
	}
	return null;
}

/**
 * 构造迷你安装：<tmp>/resources/app/{product.json, out/vs/code/<v>/workbench/workbench.html}
 * @returns {string} 迷你 appRoot
 */
function makeMiniInstall(label, srcAppDir, variantRel, tmpRoot) {
	const appDir = path.join(tmpRoot, "resources", "app");
	const wbDir = path.join(appDir, path.dirname(variantRel));
	fs.mkdirSync(wbDir, { recursive: true });
	fs.copyFileSync(path.join(srcAppDir, variantRel), path.join(wbDir, "workbench.html"));
	fs.copyFileSync(path.join(srcAppDir, "product.json"), path.join(appDir, "product.json"));
	console.log(`\n【用例 ${label}】源: ${srcAppDir}`);
	return appDir;
}

/** 单用例全流程：注入 → 断言 → 幂等复跑 → 迁移场景
 *  首轮预期状态自动推断：源文件已含注入标记（旧版注入过）→ already，否则 → injected */
function runCase(label, srcAppDir, tmpRoot) {
	const variantRel = probeVariant(srcAppDir);
	if (!variantRel) {
		check(false, `${label}: 源目录中未找到 workbench.html`);
		return;
	}
	const appDir = makeMiniInstall(label, srcAppDir, variantRel, tmpRoot);
	const wbHtml = path.join(appDir, variantRel);
	const prodPath = path.join(appDir, "product.json");

	// 依据源文件是否已含注入标记，自动推断首轮预期状态
	const srcHtml = fs.readFileSync(wbHtml, "utf-8");
	const expectFirstRun = srcHtml.includes(core.MARKER) ? "already" : "injected";
	console.log(
		`  （源文件${expectFirstRun === "already" ? "已" : "未"}含注入标记 → 首轮预期 ${expectFirstRun}）`,
	);

	// --- 第一轮：注入 ---
	const r1 = core.inject({ extensionPath: EXT_DIR, appRoot: appDir });
	check(
		r1.status === expectFirstRun,
		`第一轮注入状态 = ${expectFirstRun}（实际 ${r1.status}${r1.msg ? " / " + r1.msg : ""}）`,
	);

	const html = fs.readFileSync(wbHtml, "utf-8");
	check(html.includes(core.MARKER), "workbench.html 含注入标记");
	check(html.includes('src="./neovide-cursor.js"'), "workbench.html 含 script 引用");
	check(
		fs.existsSync(path.join(path.dirname(wbHtml), "neovide-cursor.js")),
		"neovide-cursor.js 已复制到 workbench 目录",
	);
	if (expectFirstRun === "injected") {
		check(
			fs.readdirSync(path.dirname(wbHtml)).some((f) => f.startsWith("workbench.html.bak-")),
			"workbench.html 已生成时间戳备份",
		);
	}

	// --- 校验值同步断言 ---
	const prodText = fs.readFileSync(prodPath, "utf-8");
	const key = path.relative(path.join(appDir, "out"), wbHtml).replace(/\\/g, "/");
	const expectHash = core.fileChecksum(wbHtml);
	const m = prodText.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"([^"]*)"`));
	check(m && m[1] === expectHash, `product.json 校验值已同步（${expectHash.slice(0, 10)}…）`);
	check(r1.checksum === "updated" || r1.checksum === "already", `校验同步状态 = ${r1.checksum}`);
	let prodValid = true;
	try {
		JSON.parse(prodText);
	} catch (e) {
		prodValid = false;
	}
	check(prodValid, "product.json 仍是合法 JSON");
	// 备份仅在"校验值确实被修改"（updated）时生成；源文件已同步（already）时无需备份
	if (r1.checksum === "updated") {
		check(
			fs.existsSync(prodPath + ".bak-neovide"),
			"product.json 已生成首次备份（.bak-neovide）",
		);
	} else {
		check(
			!fs.existsSync(prodPath + ".bak-neovide"),
			"校验值本就一致（already），未产生多余备份",
		);
	}

	// --- 第二轮：幂等 ---
	const r2 = core.inject({ extensionPath: EXT_DIR, appRoot: appDir });
	check(r2.status === "already", `第二轮幂等：状态 = already（实际 ${r2.status}）`);
	check(r2.checksum === "already", `第二轮幂等：校验 = already（实际 ${r2.checksum}）`);

	// --- 迁移场景：模拟 1.1.0 注入过的旧安装（html 含标记但 product.json 校验值未同步）---
	const htmlNow = fs.readFileSync(wbHtml, "utf-8");
	check(
		(htmlNow.match(/neovide-cursor\.js/g) || []).length === 1,
		"重复注入不会产生第二条 script 标签",
	);
}

// ============ 主流程 ============
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "neovide-test-"));
console.log(`临时目录: ${tmpRoot}`);

// 用例 1：Cursor（electron-sandbox，干净版）
const cursorApp = "D:/develop/Cursor/cursor/resources/app";
if (fs.existsSync(cursorApp)) {
	runCase("Cursor 3.15.19 (electron-sandbox, 干净版)", cursorApp, path.join(tmpRoot, "cursor"));
} else {
	console.log("⚠️ 跳过 Cursor 用例：未找到安装目录");
}

// 用例 2：Cursor 新版暂存目录（3.20.17）
const cursorNewApp = "D:/develop/Cursor/cursor/_/resources/app";
if (fs.existsSync(cursorNewApp)) {
	runCase("Cursor 3.20.17 (新版暂存区)", cursorNewApp, path.join(tmpRoot, "cursor-new"));
}

// 用例 3：本机 VS Code（electron-browser，已被 1.1.0 注入过 —— 迁移场景）
const vsRoot = "D:/develop/Microsoft VS Code";
if (fs.existsSync(vsRoot)) {
	const hashDir = fs
		.readdirSync(vsRoot, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(vsRoot, e.name, "resources", "app", "product.json")))[0];
	if (hashDir) {
		runCase(
			`VS Code ${hashDir.name} (electron-browser)`,
			path.join(vsRoot, hashDir.name, "resources", "app"),
			path.join(tmpRoot, "vscode"),
		);
	}
}

// ============ 汇总 ============
const failed = results.filter((r) => !r.ok);
console.log(`\n========== 结果: ${results.length - failed.length}/${results.length} 通过 ==========`);
if (failed.length) {
	console.log("失败项:");
	for (const f of failed) console.log(`  ❌ ${f.label}`);
	process.exitCode = 1;
} else {
	console.log("全部通过 ✅");
}
// 清理临时目录（失败时保留便于排查）
if (!failed.length) {
	fs.rmSync(tmpRoot, { recursive: true, force: true });
	console.log("临时目录已清理");
} else {
	console.log(`临时目录保留供排查: ${tmpRoot}`);
}
