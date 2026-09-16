/* __AUTO_CONFIG_START__ */
const cursorConfig = {
  tailColor: "#FFC0CB",
  tailOpacity: 1,
  useShadow: true,
  shadowColor: "#FFC0CB",
  shadowBlurFactor: 0.6,
  cursorDisappearDelay: 50,
  cursorFadeOutDuration: 0.075,
  animationLength: 0.1,
  shortAnimationLength: 0.05,
  shortMoveThreshold: 8,
  rank0TrailFactor: 1,
  rank1TrailFactor: 0.9,
  rank2TrailFactor: 0.5,
  rank3TrailFactor: 0.3,
  useHardSnap: true,
  leadingSnapFactor: 0.1,
  leadingSnapThreshold: 0.5,
  animationResetThreshold: 0.09,
  maxTrailDistanceFactor: 60,
  snapAnimationLength: 0.02,
  canvasFadeTransitionCss: "opacity 0.075s ease-out",
  nativeCursorDisappearTransitionCss: "opacity 0s ease-out",
  nativeCursorRevealTransitionCss: "opacity 0.075s ease-in",
  // v1.2.1 新增：是否隐藏原生光标。
  //   true（默认）= 完整 Neovide 效果：原生光标隐去，完全由 canvas 动画光标呈现
  //   false        = 保留原生光标，canvas 仅叠加拖尾（早期的实际行为）
  hideNativeCursor: true,
};
/* __AUTO_CONFIG_END__ */

// === SECTION 2: 全局状态追踪 (Global State Tracking) ===

// 记录全局范围内光标最后一次出现的位置, 用于光标在不同编辑器实例或分屏之间切换时, 能够提供一个合理的动画起始点, 防止动画从 [0,0] 坐标飞入
const globalCursorState = {
  lastX: null, // 最后记录的中心 X 坐标
  lastY: null, // 最后记录的中心 Y 坐标
  lastWidth: null, // 新增: 最后记录的光标宽度
  lastHeight: null, // 新增: 最后记录的光标高度
  lastUpdated: 0, // 最后更新时间戳
};

// === SECTION 3: 基础工具函数 (Utility Functions) ===

// HEX → RGBA(255)
const cursorHexToRgba = (hex, opacity = 1) => {
  let h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  if (h.length === 6) h += "FF";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = (parseInt(h.slice(6, 8), 16) / 255) * opacity;
  return `rgba(${r},${g},${b},${a})`;
};

// 限制数值范围
const cursorClamp = (v, min, max) => (v < min ? min : v > max ? max : v);

// 向量归一化，长度为 1，保留方向信息
const cursorNormalize = (v) => {
  const l = Math.hypot(v.x, v.y);
  return l ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
};

// 四个角点的相对坐标
const cursorRelativeCorners = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
];

// ================= 弹簧 =================
// 弹簧动画
class DampedSpringAnimation {
  constructor(l) {
    this.position = 0;
    this.velocity = 0;
    this.animationLength = l;
  }

  update(dt) {
    if (this.animationLength <= dt || Math.abs(this.position) < 0.001) {
      this.position = 0;
      this.velocity = 0;
      return false;
    }
    const o = 4.0 / this.animationLength;
    const c = Math.exp(-o * dt);
    const a = this.position;
    const b = this.position * o + this.velocity;

    this.position = (a + b * dt) * c;
    this.velocity = c * (-a * o - b * dt * o + b);

    return Math.abs(this.position) >= 0.01;
  }

  reset() {
    this.position = 0;
    this.velocity = 0;
  }
}

// ================= Corner =================
// 角点
class Corner {
  constructor(rp) {
    this.rp = rp;
    this.rpNorm = cursorNormalize(rp);
    this.cp = { x: 0, y: 0 };
    this.pd = { x: -1e5, y: -1e5 };
    this.ax = new DampedSpringAnimation(cursorConfig.animationLength);
    this.ay = new DampedSpringAnimation(cursorConfig.animationLength);
    this.TRAIL_FACTORS = [
      cursorConfig.rank0TrailFactor,
      cursorConfig.rank1TrailFactor,
      cursorConfig.rank2TrailFactor,
      cursorConfig.rank3TrailFactor,
    ];
  }

  getDest(c, dim) {
    return {
      x: c.x + this.rp.x * dim.width,
      y: c.y + this.rp.y * dim.height,
    };
  }

  calculateDirectionAlignment(dim, center) {
    const dest = this.getDest(center, dim);
    const dx = dest.x - this.cp.x;
    const dy = dest.y - this.cp.y;
    const len = Math.hypot(dx, dy);
    return len ? (dx / len) * this.rpNorm.x + (dy / len) * this.rpNorm.y : 0;
  }

  jump(c, dim, rank) {
    const dest = this.getDest(c, dim);
    const jv = {
      x: (dest.x - this.pd.x) / dim.width,
      y: (dest.y - this.pd.y) / dim.height,
    };

    const len = Math.hypot(jv.x, jv.y);
    const jvNorm = len ? { x: jv.x / len, y: jv.y / len } : { x: 0, y: 0 };

    const isShortMove =
      Math.hypot(jv.x, jv.y) <= cursorConfig.shortMoveThreshold;

    const baseTime = isShortMove
      ? cursorConfig.shortAnimationLength
      : cursorConfig.animationLength;

    const alignment = jvNorm.x * this.rpNorm.x + jvNorm.y * this.rpNorm.y;

    const useSnap =
      cursorConfig.useHardSnap && alignment > cursorConfig.leadingSnapThreshold;

    const factor = useSnap
      ? cursorConfig.leadingSnapFactor
      : (this.TRAIL_FACTORS[rank] ?? 1);

    const lenAnim = useSnap
      ? cursorConfig.snapAnimationLength
      : baseTime * cursorClamp(factor, 0, 1);

    this.ax.animationLength = lenAnim;
    this.ay.animationLength = lenAnim;

    if (lenAnim > cursorConfig.animationResetThreshold) {
      this.ax.reset();
      this.ay.reset();
    }
  }

  update(dim, c, dt, imm) {
    const destX = c.x + this.rp.x * dim.width;
    const destY = c.y + this.rp.y * dim.height;

    if (destX !== this.pd.x || destY !== this.pd.y) {
      this.ax.position = destX - this.cp.x;
      this.ay.position = destY - this.cp.y;
      this.pd.x = destX;
      this.pd.y = destY;
    }

    if (imm) {
      this.cp.x = destX;
      this.cp.y = destY;
      this.ax.reset();
      this.ay.reset();
      return false;
    }

    this.ax.update(dt);
    this.ay.update(dt);

    const maxD =
      Math.max(dim.width, dim.height) * cursorConfig.maxTrailDistanceFactor;

    this.ax.position = cursorClamp(this.ax.position, -maxD, maxD);
    this.ay.position = cursorClamp(this.ay.position, -maxD, maxD);

    this.cp.x = destX - this.ax.position;
    this.cp.y = destY - this.ay.position;

    return Math.abs(this.ax.position) > 0.5 || Math.abs(this.ay.position) > 0.5;
  }
}

// === SECTION 6: 单个光标实例创建器 (Cursor Instance Creator) ===

// 工厂函数: 负责生成并管理一个完整的光标渲染逻辑
const createNeovideCursor = ({ canvas }) => {
  // 预计算颜色值, 减少绘图时的重复计算开销
  const finalColorCss = cursorHexToRgba(
    cursorConfig.tailColor,
    cursorConfig.tailOpacity,
  );
  const shadowColorCss =
    cursorConfig.useShadow && cursorHexToRgba(cursorConfig.shadowColor);

  const context = canvas.getContext("2d");
  let cursorDimensions = { width: 8, height: 18 },
    centerDest = { x: 0, y: 0 },
    lastT = performance.now(),
    initialized = false,
    jumped = false;

  // 为该光标初始化四个独立物理角点
  const corners = cursorRelativeCorners.map((p) => new Corner(p));

  const initCorners = (center, dim) => {
    corners.forEach((c) => {
      const d = c.getDest(center, dim);
      c.cp = d;
      c.pd = d;
    });
  };
  return {
    // move 方法: 外部驱动接口, 告诉插件光标的目标坐标
    move: (x, y, fromSource = null) => {
      if ((x <= 0 && y <= 0) || isNaN(x) || isNaN(y)) return;
      centerDest.x = x + cursorDimensions.width / 2;
      centerDest.y = y + cursorDimensions.height / 2;

      if (!initialized || fromSource) {
        const src =
          fromSource ||
          (globalCursorState.lastX && {
            x: globalCursorState.lastX,
            y: globalCursorState.lastY,
          });
        initCorners(src ?? centerDest, cursorDimensions);
        initialized = true;
      }
      jumped = true; // 触发 Rank 重新分配
      globalCursorState.lastX = centerDest.x;
      globalCursorState.lastY = centerDest.y;
      globalCursorState.lastWidth = cursorDimensions.width;
      globalCursorState.lastHeight = cursorDimensions.height;
      globalCursorState.lastUpdated = Date.now();
    },

    updateSize: (w, h) => {
      if (w > 0) {
        cursorDimensions.width = w;
        cursorDimensions.height = h;
      }
    },

    // updateLoop 方法: 每一帧执行的 Canvas 绘图循环
    updateLoop: (isS, draw) => {
      if (!initialized) return false;
      const now = performance.now(),
        dt = Math.min((now - lastT) / 1000, 1 / 30);
      lastT = now;

      if (jumped) {
        // 根据对齐度对四个角点进行排序, 从而分配不同的滞后系数
        const tmp = corners.map((c, i) => ({
          i,
          v: c.calculateDirectionAlignment(cursorDimensions, centerDest),
        }));

        tmp.sort((a, b) => a.v - b.v);

        const ranks = [];
        for (let r = 0; r < tmp.length; r++) {
          ranks[tmp[r].i] = r;
        }

        corners.forEach((c, i) =>
          c.jump(centerDest, cursorDimensions, ranks[i]),
        );
        jumped = false;
      }

      let anim = false;
      corners.forEach((c) => {
        if (c.update(cursorDimensions, centerDest, dt, isS)) anim = true;
      });

      if (draw) {
        // 执行 2D 绘图: 按照角点物理坐标描绘多边形并填充颜色
        context.beginPath();
        context.moveTo(corners[0].cp.x, corners[0].cp.y);
        for (let i = 1; i < 4; i++)
          context.lineTo(corners[i].cp.x, corners[i].cp.y);
        context.closePath();
        context.fillStyle = finalColorCss;
        if (cursorConfig.useShadow) {
          context.shadowColor = shadowColorCss;
          context.shadowBlur =
            cursorConfig.shadowBlurFactor *
            Math.max(cursorDimensions.width, cursorDimensions.height);
        }
        context.fill();
        context.shadowBlur = 0;
        context.shadowColor = "transparent";
      }
      return anim;
    },
  };
};

// === SECTION 7: 全局光标管理器 (Global Cursor Manager) ===
//
// v1.2.1 性能重构（修复宿主渲染进程崩溃问题）：
//   旧实现用 MutationObserver 全量监听 document.body —— 宿主每秒发生数百上千次
//   DOM 变化，每次回调都执行一次全文档 querySelectorAll，叠加渲染循环内每帧的
//   强制布局读取（getBoundingClientRect），在高负载场景（宿主启动洪流）会把渲染
//   主线程拖入崩溃。重构为：
//     1. 脏标记 + 帧内消费：输入/选择类事件只置位标记（近零成本），渲染帧消费
//        标记时才做一次位置读取，且只针对已知光标（成本 O(光标数)）
//     2. 低频兜底扫描（SYNC_INTERVAL）：负责发现新光标 / 回收消失光标
//     3. 延迟启动（START_DELAY）：页面 load 后再延迟启动，避开宿主启动期的
//        DOM 洪流（崩溃循环的直接诱因）
//     4. 空闲/后台暂停：页面不可见时挂起渲染循环
//     5. 渲染帧内零 DOM 读取：位置用扫描阶段缓存，绘制阶段纯内存运算

// 配置常量
const MAX_CURSORS = 40; // 光标实例数量上限（自我保护，防异常场景下无限增长）
const SYNC_INTERVAL = 400; // 全量扫描间隔（ms）
const START_DELAY = 1500; // 页面 load 后的启动延迟（ms）

// GlobalCursorManager 类: 系统的控制塔：负责扫描 DOM 节点、同步多光标实例、控制原生光标的显隐以及渲染 Canvas
class GlobalCursorManager {
  constructor() {
    this.cursors = new Map(); // 存储活跃光标实例及其对应的 DOM 元素
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.isScrolling = false; // 滚动状态锁
    this.winW = window.innerWidth;
    // —— v1.2.1 性能重构新增状态 ——
    this.needsSync = false; // 脏标记：有事件提示光标可能变化
    this.lastFullSync = 0; // 上次全量扫描的时间戳（ms）
    this.loopBound = this.loop.bind(this); // 只绑定一次，避免每帧新建函数
    this.paused = document.hidden; // 页面隐藏时暂停渲染
    this.errLogged = false; // 循环异常只上报一次，避免刷屏
    this.init();
  }

  // 启动环境初始化
  init() {
    // 注入全局样式: 禁用原生的光标平滑过渡, 否则物理引擎无法接管
    const style = document.createElement("style");
    style.textContent = `
            .monaco-editor .cursor {
                transition: none !important;
            }
            .cursor-trail {
                opacity: 0 !important;
            }
        `;
    document.head.appendChild(style);

    // 设置全屏透明画板
    this.canvas.style.cssText = `
            pointer-events: none;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 9999;
            opacity: 0;
            transition: none;
        `;
    document.body.appendChild(this.canvas);

    window.addEventListener("resize", () => {
      this.winW = window.innerWidth;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // 全局滚动检测: 页面滚动时, 光标必须停止物理形变并紧贴行首
    document.addEventListener(
      "scroll",
      () => {
        this.isScrolling = true;
        this.needsSync = true; // 滚动会改变光标位置，置脏
        clearTimeout(this.sT);
        this.sT = setTimeout(() => (this.isScrolling = false), 100);
      },
      { capture: true, passive: true },
    );

    // 脏标记事件源（v1.2.1）：这些事件都可能让光标移动/显示状态变化。
    // 只置位标记（近零成本），真正的 DOM 读取推迟到渲染帧内消费一次，
    // 替代旧版"MutationObserver 全量监听 → 每次变化全文档查询"的方案。
    const markDirty = () => {
      this.needsSync = true;
    };
    for (const evt of [
      "keydown",
      "keyup",
      "mousemove", // v1.2.2：拖动选择时光标跟随鼠标移动，必须置脏（帧内消费，成本极低）
      "mousedown",
      "mouseup",
      "focusin",
      "focusout",
    ]) {
      window.addEventListener(evt, markDirty, { capture: true, passive: true });
    }
    document.addEventListener("selectionchange", markDirty, { passive: true });

    // 页面可见性：切后台暂停渲染循环（省电），回前台恢复
    document.addEventListener("visibilitychange", () => {
      this.paused = document.hidden;
      if (!this.paused) {
        this.needsSync = true;
        requestAnimationFrame(this.loopBound);
      }
    });

    this.lastFullSync = performance.now();
    this.syncCursors(true); // 首次全量扫描
    requestAnimationFrame(this.loopBound);
  }

  /**
   * 扫描并同步光标状态（v1.2.1：本函数是全脚本唯一的 DOM 读取点）。
   *
   * @param {boolean} full true  = 全量扫描：querySelectorAll 发现新光标、回收消失光标
   *                       false = 增量同步：只更新已知光标的位置/可见性（成本 O(光标数)）
   *
   * 设计说明：
   *  - 读取集中成批执行、且只读不写（写操作全部在后续 canvas 绘制阶段），
   *    避免读写交替引发浏览器的重复布局计算；
   *  - 全量路径由低频兜底（SYNC_INTERVAL），增量路径由输入事件脏标记驱动，
   *    打字响应不受低频兜底影响。
   */
  syncCursors(full) {
    if (full) {
      // —— 全量路径：发现新元素、回收消失元素 ——
      const els = document.querySelectorAll(".monaco-editor .cursor");
      const seen = new Set();

      els.forEach((el) => {
        seen.add(el);

        if (this.cursors.has(el)) return;

        // 自我保护：实例数量异常增长时停止新建（宿主 DOM 异常场景下避免拖垮渲染进程）
        if (this.cursors.size >= MAX_CURSORS) return;

        const r = el.getBoundingClientRect();
        if (r.left <= 0 && r.top <= 0) return;

        const inst = createNeovideCursor({ canvas: this.canvas });
        inst.updateSize(r.width, r.height);

        inst.move(
          r.left,
          r.top,
          globalCursorState.lastX
            ? { x: globalCursorState.lastX, y: globalCursorState.lastY }
            : null,
        );

        this.cursors.set(el, {
          instance: inst,
          target: el, // v1.2.1 修复：旧版缺少该字段，导致原生光标隐藏逻辑从未生效
          lastX: r.left,
          lastY: r.top,
          isActive: false,
        });
      });

      // 回收不存在的光标
      for (const el of this.cursors.keys()) {
        if (!seen.has(el) || !el.isConnected) {
          this.cursors.delete(el);
        }
      }
    }

    // —— 位置/可见性更新（全量与增量两条路径共用）——
    for (const [el, data] of this.cursors) {
      if (!el.isConnected) {
        this.cursors.delete(el);
        continue;
      }

      const r = el.getBoundingClientRect();
      const hasMoved = r.left !== data.lastX || r.top !== data.lastY;
      let isNowActive = data.isActive;
      if (!data.isActive || hasMoved) {
        const style = getComputedStyle(el);
        isNowActive =
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !style.transform.includes("-10000px");
      }

      if (!isNowActive) {
        data.isActive = false;
        data.rect = r; // 缓存位置，供渲染帧判断视口可见性
        continue;
      }

      if (isNowActive && !data.isActive) {
        data.isJumping = true;
        data.jumpSource = globalCursorState.lastX
          ? { x: globalCursorState.lastX, y: globalCursorState.lastY }
          : null;
      }

      if (hasMoved && isNowActive) {
        data.instance.updateSize(r.width, r.height);
        data.instance.move(
          r.left,
          r.top,
          data.isJumping ? data.jumpSource : null,
        );
        data.lastX = r.left;
        data.lastY = r.top;
        data.isJumping = false;
      }

      data.isActive = isNowActive;
      data.rect = r; // 缓存位置，渲染帧不再读取 DOM
    }
  }

  // 显隐逻辑提取为独立函数（降低复杂度）
  updateVisibility(isAnyAnimating) {
    if (isAnyAnimating) {
      if (this.canvas.style.opacity !== "1") {
        this.canvas.style.transition = "none";
        this.canvas.style.opacity = "1";
      }
      // v1.2.1：仅在开启 hideNativeCursor 时隐藏原生光标
      if (cursorConfig.hideNativeCursor) {
        this.cursors.forEach((d) => {
          if (d.isActive && d.target) {
            d.target.style.transition =
              cursorConfig.nativeCursorDisappearTransitionCss;
            d.target.style.opacity = "0";
          }
        });
      }
      return;
    }

    if (this.canvas.style.opacity === "1") {
      // v1.2.1：句柄保存并去重，避免高频启停时堆积无用定时器
      clearTimeout(this.fadeTimer);
      this.fadeTimer = setTimeout(() => {
        this.canvas.style.transition = cursorConfig.canvasFadeTransitionCss;
        this.canvas.style.opacity = "0";
      }, cursorConfig.cursorDisappearDelay);
    }

    if (cursorConfig.hideNativeCursor) {
      this.cursors.forEach((d) => {
        if (d.isActive && d.target) {
          d.target.style.transition =
            cursorConfig.nativeCursorRevealTransitionCss;
          d.target.style.opacity = "1";
        }
      });
    }
  }

  // loop 方法: 顶层渲染引擎, 控制每一帧的最终输出。
  // v1.2.1：本函数不再读取 DOM（位置用扫描阶段缓存的 data.rect），
  // 只做纯内存物理计算与 canvas 绘制。
  loop() {
    if (this.paused) return; // 页面隐藏时挂起，由 visibilitychange 恢复

    try {
      const now = performance.now();

      // 1. DOM 读取阶段：
      //    - 脏标记：输入/选择等事件后消费一次（保证打字时的响应速度）
      //    - 低频兜底：每隔 SYNC_INTERVAL 全量扫描一次（发现新光标/位置漂移）
      if (this.needsSync || now - this.lastFullSync >= SYNC_INTERVAL) {
        const full = now - this.lastFullSync >= SYNC_INTERVAL;
        if (full) this.lastFullSync = now;
        this.needsSync = false;
        this.syncCursors(full);
      }

      // 2. 绘制阶段：纯内存物理 + canvas 绘制
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      let isAnyAnimating = false;

      for (const [el, data] of this.cursors) {
        if (!data.isActive) continue;

        const r = data.rect || el.getBoundingClientRect();
        const anim = data.instance.updateLoop(
          this.isScrolling,
          r.left >= 0 && r.top >= 0 && r.left <= this.winW,
        );
        data.isAnimating = anim;
        if (anim) isAnyAnimating = true;
      }

      this.updateVisibility(isAnyAnimating);
    } catch (e) {
      // 单帧异常不应终止整个渲染循环
      if (!this.errLogged) {
        console.warn("[NeovideCursor] 渲染循环异常:", e);
        this.errLogged = true;
      }
    }

    requestAnimationFrame(this.loopBound);
  }
}

// ============ 启动（v1.2.1：延迟启动，避开宿主启动期的 DOM 洪流）============
// 背景：注入脚本是普通 <script>（解析到即执行），而宿主的 workbench.js 是
// module（延迟执行）——脚本若立即启动，会从宿主 UI 尚未构建时就开始承受启动期
// 最猛烈的 DOM 变化，这正是"更新后渲染进程崩溃循环"的直接诱因。
// 改为：页面 load 完成、且额外延迟 START_DELAY 后再启动。
(function bootstrap() {
  const start = () => setTimeout(() => new GlobalCursorManager(), START_DELAY);
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();
