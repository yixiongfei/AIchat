import {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  clipboard,
  Notification,
  ipcMain,
  nativeImage,
  NativeImage,
  screen,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { translateText } from "./translate";
import { keyboard, Key, sleep } from "@nut-tree-fork/nut-js";

// ========================================
// 配置
// ========================================

const IS_DEV = process.argv.includes("--dev");
const DEV_URL = process.env.VITE_DEV_URL || "http://localhost:5173";
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";

const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 640;
const EDGE_THRESHOLD = 10;      // 贴边检测像素
const PEEK_SIZE = 4;            // 隐藏后露出的像素条
const MOUSE_POLL_MS = 100;      // 鼠标位置轮询间隔
const ANIM_DURATION = 220;      // 滑动动画时长(ms)
const ANIM_FPS = 60;            // 动画帧率
const LEAVE_DELAY_MS = 400;     // 鼠标离开后延迟隐藏(ms)，防止抖动
const COOLDOWN_MS = 600;        // 动画结束后冷却时间(ms)，防止连续触发

// ========================================
// 全局变量
// ========================================

let mainWindow: BrowserWindow | null = null;
let live2dWindow: BrowserWindow | null = null;
let cursorPoller: ReturnType<typeof setInterval> | null = null;  // Live2D 全屏光标追踪轮询
let tray: Tray | null = null;
let isQuitting = false;

// 贴边停靠状态机: normal → docked-hidden ⇄ docked-visible
type DockState = "normal" | "docked-hidden" | "docked-visible";
let dockState: DockState = "normal";
let dockedEdge: "top" | "left" | "right" | null = null;
let savedBounds: Electron.Rectangle | null = null;  // 贴边前的原始位置
let hiddenBounds: Electron.Rectangle | null = null;  // 隐藏时的位置（只露出 PEEK_SIZE）
let mousePoller: ReturnType<typeof setInterval> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;
let isAnimating = false;
let lastAnimEnd = 0;  // 上次动画结束时间戳，用于冷却

// ========================================
// 窗口创建（启动后自动弹出，定位右上角）
// ========================================

function createWindow(): void {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: screenW - DEFAULT_WIDTH - 20,
    y: 20,
    minWidth: 320,
    minHeight: 420,
    useContentSize: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    show: true,
    transparent: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, "web", "index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopMousePoller();
    clearLeaveTimer();
  });

  // 通知渲染进程最大化状态变化；最大化时脱离停靠
  mainWindow.on("maximize", () => {
    if (dockState !== "normal") undock();
    mainWindow?.webContents.send("maximized-changed", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("maximized-changed", false);
  });

  // 窗口移动结束后检测是否贴边
  mainWindow.on("moved", () => checkEdgeDock());

  // 最小化时显示 Live2D 桌面宠物，恢复时销毁
  mainWindow.on("minimize", () => createLive2DWindow());
  mainWindow.on("restore", () => destroyLive2DWindow());
}

// ========================================
// 平滑动画工具
// ========================================

/** easeOutCubic 缓动函数 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 平滑动画移动窗口 */
function animateBounds(
  from: Electron.Rectangle,
  to: Electron.Rectangle,
  onDone?: () => void
): void {
  if (!mainWindow) { onDone?.(); return; }

  isAnimating = true;
  const totalFrames = Math.max(1, Math.round((ANIM_DURATION / 1000) * ANIM_FPS));
  let frame = 0;

  const timer = setInterval(() => {
    frame++;
    const progress = easeOutCubic(frame / totalFrames);

    const current = {
      x: Math.round(from.x + (to.x - from.x) * progress),
      y: Math.round(from.y + (to.y - from.y) * progress),
      width: Math.round(from.width + (to.width - from.width) * progress),
      height: Math.round(from.height + (to.height - from.height) * progress),
    };

    mainWindow?.setBounds(current);

    if (frame >= totalFrames) {
      clearInterval(timer);
      mainWindow?.setBounds(to);  // 确保精确到终点
      isAnimating = false;
      onDone?.();
    }
  }, Math.round(1000 / ANIM_FPS));
}

// ========================================
// 贴边停靠（状态机 + 滑动动画 + 防抖）
// ========================================

/** 是否在冷却期内 */
function inCooldown(): boolean {
  return Date.now() - lastAnimEnd < COOLDOWN_MS;
}

/** 计算隐藏位置（只露出 PEEK_SIZE 像素） */
function calcHiddenBounds(
  edge: "top" | "left" | "right",
  bounds: Electron.Rectangle,
  workArea: Electron.Rectangle
): Electron.Rectangle {
  const target = { ...bounds };
  if (edge === "top") {
    target.y = workArea.y - bounds.height + PEEK_SIZE;
  } else if (edge === "left") {
    target.x = workArea.x - bounds.width + PEEK_SIZE;
  } else {
    target.x = workArea.x + workArea.width - PEEK_SIZE;
  }
  return target;
}

/** 鼠标是否在窗口附近 */
function isCursorNearWindow(pad: number): boolean {
  if (!mainWindow) return false;
  const cursor = screen.getCursorScreenPoint();
  const win = mainWindow.getBounds();
  return (
    cursor.x >= win.x - pad &&
    cursor.x <= win.x + win.width + pad &&
    cursor.y >= win.y - pad &&
    cursor.y <= win.y + win.height + pad
  );
}

/** 1) 拖动窗口后检测是否贴边 → 进入 docked-hidden */
function checkEdgeDock(): void {
  if (!mainWindow || mainWindow.isMaximized() || dockState !== "normal" || isAnimating) return;

  const bounds = mainWindow.getBounds();
  const workArea = screen.getDisplayMatching(bounds).workArea;

  let edge: "top" | "left" | "right" | null = null;
  if (bounds.y <= workArea.y + EDGE_THRESHOLD) {
    edge = "top";
  } else if (bounds.x <= workArea.x + EDGE_THRESHOLD) {
    edge = "left";
  } else if (bounds.x + bounds.width >= workArea.x + workArea.width - EDGE_THRESHOLD) {
    edge = "right";
  }

  if (!edge) return;

  // 记住原始位置和边缘方向
  savedBounds = { ...bounds };
  dockedEdge = edge;
  hiddenBounds = calcHiddenBounds(edge, bounds, workArea);

  // 滑出隐藏
  slideToHidden();
}

/** 2) 滑动到隐藏位置 */
function slideToHidden(): void {
  if (!mainWindow || !hiddenBounds || isAnimating) return;

  const from = mainWindow.getBounds();
  animateBounds(from, hiddenBounds, () => {
    dockState = "docked-hidden";
    lastAnimEnd = Date.now();
    startMousePoller();
  });
}

/** 3) 滑动到可见位置（恢复到原始大小位置） */
function slideToVisible(): void {
  if (!mainWindow || !savedBounds || isAnimating) return;

  clearLeaveTimer();
  const from = mainWindow.getBounds();
  animateBounds(from, savedBounds, () => {
    dockState = "docked-visible";
    lastAnimEnd = Date.now();
    // 不清除 poller，继续监测鼠标离开
  });
}

/** 4) 完全脱离停靠（比如用户在可见状态下拖走窗口） */
function undock(): void {
  dockState = "normal";
  dockedEdge = null;
  savedBounds = null;
  hiddenBounds = null;
  stopMousePoller();
  clearLeaveTimer();
}

/** 鼠标轮询：根据 dockState 决定恢复还是隐藏 */
function startMousePoller(): void {
  stopMousePoller();
  mousePoller = setInterval(() => {
    if (!mainWindow || isAnimating || inCooldown()) return;

    if (dockState === "docked-hidden") {
      // 鼠标靠近 → 恢复可见
      if (isCursorNearWindow(20)) {
        slideToVisible();
      }
    } else if (dockState === "docked-visible") {
      // 鼠标远离 → 延迟隐藏
      if (!isCursorNearWindow(30)) {
        scheduleLeaveHide();
      } else {
        // 鼠标回来了，取消延迟隐藏
        clearLeaveTimer();
      }
    }
  }, MOUSE_POLL_MS);
}

function stopMousePoller(): void {
  if (mousePoller) {
    clearInterval(mousePoller);
    mousePoller = null;
  }
}

/** 延迟隐藏（鼠标离开后等一小段时间再隐藏，防止抖动） */
function scheduleLeaveHide(): void {
  if (leaveTimer) return; // 已有计划中的隐藏
  leaveTimer = setTimeout(() => {
    leaveTimer = null;
    if (dockState !== "docked-visible" || isAnimating || inCooldown()) return;
    // 再次确认鼠标确实离开了
    if (!isCursorNearWindow(30)) {
      slideToHidden();
    }
  }, LEAVE_DELAY_MS);
}

function clearLeaveTimer(): void {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
}

/** 从外部调用恢复窗口（托盘点击、快捷键等） */
function restoreFromDock(): void {
  if (dockState === "normal") return;
  if (isAnimating) return;

  clearLeaveTimer();
  stopMousePoller();

  if (mainWindow && savedBounds) {
    mainWindow.setBounds(savedBounds);
  }

  undock();
  destroyLive2DWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

// ========================================
// Live2D 桌面宠物（最小化时显示）
// ========================================

const LIVE2D_WIDTH = 350;
const LIVE2D_HEIGHT = 400;

const LIVE2D_OVERLAY_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: transparent !important;
    overflow: hidden;
    width: 100%;
    height: 100%;
  }
  #waifu {
    background: transparent !important;
  }
</style>
</head>
<body>
<script src="https://cdn.jsdelivr.net/gh/yixiongfei/live2d-widget@master/dist/autoload.js"><\/script>
<script>
  // live2d-widget DOM structure:
  //   #waifu-toggle  (show/hide button)
  //   #waifu         (main container)
  //     #waifu-tips   (bubble)
  //     #waifu-canvas > canvas#live2d
  //     #waifu-tool   (toolbar)

  // Wait for widget to load
  var observer = new MutationObserver(function() {
    var waifu = document.getElementById('waifu');
    if (waifu) {
      setupMouseHandler();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function setupMouseHandler() {
    document.addEventListener('mousemove', function(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && (el.tagName === 'CANVAS' || el.closest('#waifu'))) {
        window.live2dAPI && window.live2dAPI.setIgnoreMouseEvents(false);
      } else {
        window.live2dAPI && window.live2dAPI.setIgnoreMouseEvents(true);
      }
    });
    document.addEventListener('mouseleave', function() {
      window.live2dAPI && window.live2dAPI.setIgnoreMouseEvents(true);
    });
  }

  // Double-click to restore main window
  document.addEventListener('dblclick', function(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && (el.tagName === 'CANVAS' || el.closest('#waifu'))) {
      window.live2dAPI && window.live2dAPI.restoreMainWindow();
    }
  });

  // Cursor tracking
  if (window.live2dAPI && window.live2dAPI.onCursorMove) {
    window.live2dAPI.onCursorMove(function(pos) {
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: pos.x,
        clientY: pos.y,
        bubbles: true
      }));
    });
  }

<\/script>
</body>
</html>`;

/** 获取 Live2D 覆盖层 HTML 文件路径（写入临时文件） */
function getLive2DHTMLPath(): string {
  const p = path.join(os.tmpdir(), "letta-live2d-overlay.html");
  fs.writeFileSync(p, LIVE2D_OVERLAY_HTML, "utf-8");
  return p;
}

/** 创建 Live2D 桌面宠物窗口 */
function createLive2DWindow(): void {
  if (live2dWindow) return; // 已存在

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const { x: workX, y: workY } = display.workArea;

  live2dWindow = new BrowserWindow({
    width: LIVE2D_WIDTH,
    height: LIVE2D_HEIGHT,
    x: workX + screenW - LIVE2D_WIDTH,
    y: workY + screenH - LIVE2D_HEIGHT,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload-live2d.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 初始设置为鼠标穿透（透明区域不拦截鼠标事件）
  live2dWindow.setIgnoreMouseEvents(true, { forward: true });

  try {
    const htmlPath = getLive2DHTMLPath();
    live2dWindow.loadFile(htmlPath);
  } catch (err) {
    console.error("Failed to create Live2D overlay:", err);
    live2dWindow?.destroy();
    live2dWindow = null;
    return;
  }

  live2dWindow.on("closed", () => {
    live2dWindow = null;
    stopCursorPoller();
  });

  // 启动全屏光标追踪轮询
  startCursorPoller();

}

/** 启动光标位置轮询，将屏幕光标坐标转发给 Live2D 渲染进程（每 60 秒一次快照） */
function startCursorPoller(): void {
  stopCursorPoller();
  // 立即发送一次当前位置
  sendCursorPosition();
  cursorPoller = setInterval(() => sendCursorPosition(), 60000);
}

function sendCursorPosition(): void {
  if (!live2dWindow || live2dWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const bounds = live2dWindow.getBounds();
  live2dWindow.webContents.send("cursor-move", {
    x: cursor.x - bounds.x,
    y: cursor.y - bounds.y,
  });
}

/** 停止光标位置轮询 */
function stopCursorPoller(): void {
  if (cursorPoller) {
    clearInterval(cursorPoller);
    cursorPoller = null;
  }
}

/** 销毁 Live2D 桌面宠物窗口 */
function destroyLive2DWindow(): void {
  stopCursorPoller();
  if (live2dWindow) {
    live2dWindow.destroy();
    live2dWindow = null;
  }
}

// ========================================
// 系统托盘
// ========================================

const TRAY_ICON_NAME = "microsoft_teams_alt_macos_bigsur_icon_189962.ico";

function createTray(): void {
  const iconCandidates = IS_DEV
    ? [
        path.join(__dirname, "..", TRAY_ICON_NAME),
        path.join(__dirname, "..", "icon.ico"),
      ]
    : [
        path.join(process.resourcesPath, "..", TRAY_ICON_NAME),
        path.join(process.resourcesPath, TRAY_ICON_NAME),
        path.join(process.resourcesPath, "..", "icon.ico"),
        path.join(process.resourcesPath, "icon.ico"),
      ];

  let trayIcon: NativeImage | null = null;
  for (const p of iconCandidates) {
    try {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) { trayIcon = img; break; }
    } catch { /* next */ }
  }

  if (!trayIcon || trayIcon.isEmpty()) {
    const s = 16, buf = Buffer.alloc(s * s * 4);
    for (let i = 0; i < s * s; i++) { buf[i*4]=59; buf[i*4+1]=130; buf[i*4+2]=246; buf[i*4+3]=255; }
    trayIcon = nativeImage.createFromBuffer(buf, { width: s, height: s });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("Letta Chat");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show", click: () => { restoreFromDock(); mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));

  tray.on("click", () => {
    if (dockState !== "normal") {
      restoreFromDock();
    } else if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// ========================================
// 全局快捷键
// ========================================

function detectLang(text: string): "ja" | "zh" | "other" {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  return "other";
}

function getTargetLang(src: "ja" | "zh" | "other"): string | null {
  if (src === "ja") return "zh";
  if (src === "zh") return "ja";
  return null;
}

function registerShortcuts(): void {
  globalShortcut.register("Alt+Space", () => {
    if (!mainWindow) return;
    if (dockState !== "normal") { restoreFromDock(); }
    else if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  globalShortcut.register("Control+B", async () => {
    try {
      const prev = clipboard.readText();
      await keyboard.pressKey(Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.C, Key.LeftControl);
      await sleep(120);
      const text = clipboard.readText().trim();
      if (!text || text === prev) { showNotification("Translate", "No text selected"); return; }

      const src = detectLang(text);
      const target = getTargetLang(src);
      if (!target) { showNotification("Translate", "Not ZH/JA text"); return; }

      showNotification(src === "ja" ? "JA -> ZH ..." : "ZH -> JA ...", text.slice(0, 50));
      const result = await translateText(text, target, API_BASE);
      clipboard.writeText(result);
      showNotification("Done (copied)", result);
      mainWindow?.webContents.send("translate-result", { original: text, translated: result, from: src, to: target });
    } catch (err: any) {
      showNotification("Translate failed", err?.message || "Check backend");
    }
  });
}

function showNotification(title: string, body: string): void {
  new Notification({ title, body, silent: true }).show();
}

// ========================================
// IPC 事件处理
// ========================================

function setupIPC(): void {
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-close", () => mainWindow?.hide());
  ipcMain.on("window-maximize", () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on("window-toggle-top", () => {
    if (!mainWindow) return;
    const isTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isTop);
    mainWindow.webContents.send("always-on-top-changed", !isTop);
  });

  // Live2D 桌面宠物 IPC
  ipcMain.on("live2d-restore", () => {
    destroyLive2DWindow();
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  ipcMain.on("live2d-set-ignore-mouse", (_event, ignore: boolean) => {
    if (!live2dWindow) return;
    if (ignore) {
      live2dWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      live2dWindow.setIgnoreMouseEvents(false);
    }
  });
}

// ========================================
// App 生命周期
// ========================================

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (dockState !== "normal") restoreFromDock();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    try { createTray(); } catch (err) { console.error("Tray failed:", err); }
    registerShortcuts();
    setupIPC();
    console.log(`Letta Chat Desktop | ${IS_DEV ? "DEV" : "PROD"} | API: ${API_BASE}`);
  });

  app.on("before-quit", () => { isQuitting = true; destroyLive2DWindow(); });
  app.on("will-quit", () => { globalShortcut.unregisterAll(); stopMousePoller(); clearLeaveTimer(); });
  app.on("window-all-closed", () => { /* tray keeps alive */ });
  app.on("activate", () => { if (!mainWindow) createWindow(); });
}
