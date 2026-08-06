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

// GlobalCursorManager 类: 系统的控制塔：负责扫描 DOM 节点、同步多光标实例、控制原生光标的显隐以及渲染 Canvas
class GlobalCursorManager {
  constructor() {
    this.cursors = new Map(); // 存储活跃光标实例及其对应的 DOM 元素
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.isScrolling = false; // 滚动状态锁
    this.winW = window.innerWidth;
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
        clearTimeout(this.sT);
        this.sT = setTimeout(() => (this.isScrolling = false), 100);
      },
      { capture: true, passive: true },
    );

    this.initObserver();
    this.loop();
  }

  initObserver() {
    const observer = new MutationObserver(() => {
      this.syncCursors();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.syncCursors();
  }

  // scan 方法: 探测并匹配 DOM 元素与物理实例
  syncCursors() {
    const els = document.querySelectorAll(".monaco-editor .cursor");
    const seen = new Set();

    els.forEach((el) => {
      seen.add(el);

      if (this.cursors.has(el)) return;

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

  // 显隐逻辑提取为独立函数（降低复杂度）
  updateVisibility(isAnyAnimating) {
    if (isAnyAnimating) {
      this.canvas.style.transition = "none";
      if (this.canvas.style.opacity !== "1") {
        this.canvas.style.transition = "none";
        this.canvas.style.opacity = "1";
      }
      this.cursors.forEach((d) => {
        if (d.isActive && d.target) {
          d.target.style.transition =
            cursorConfig.nativeCursorDisappearTransitionCss;
          d.target.style.opacity = "0";
        }
      });
      return;
    }

    if (this.canvas.style.opacity === "1") {
      setTimeout(() => {
        this.canvas.style.transition = cursorConfig.canvasFadeTransitionCss;
        this.canvas.style.opacity = "0";
      }, cursorConfig.cursorDisappearDelay);
    }

    this.cursors.forEach((d) => {
      if (d.isActive && d.target) {
        d.target.style.transition =
          cursorConfig.nativeCursorRevealTransitionCss;
        d.target.style.opacity = "1";
      }
    });
  }

  // loop 方法: 顶层渲染引擎, 控制每一帧的最终输出
  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let isAnyAnimating = false;

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

      if (isNowActive) {
        const anim = data.instance.updateLoop(
          this.isScrolling,
          r.left >= 0 && r.top >= 0 && r.left <= this.winW,
        );
        data.isAnimating = anim;
        if (anim) isAnyAnimating = true;
      }
    }

    this.updateVisibility(isAnyAnimating);
    requestAnimationFrame(this.loop.bind(this));
  }
}

// 启动全局光标管理器
new GlobalCursorManager();
