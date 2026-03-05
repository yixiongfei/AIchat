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
} from "electron";
import * as path from "path";
import { translateText } from "./translate";
import { keyboard, Key, sleep } from "@nut-tree-fork/nut-js";
// ========================================
// 配置
// ========================================

const IS_DEV = process.argv.includes("--dev");
const DEV_URL = process.env.VITE_DEV_URL || "http://localhost:5173";
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";

// ========================================
// 全局变量
// ========================================

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false; // 标记是否正在退出（而非隐藏到托盘）

// ========================================
// 窗口创建
// ========================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 320,
    minHeight: 420,
    useContentSize: true,
    frame: false,
    thickFrame: false,        // ✅ 打开它（仅 Windows 有效）
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    show: false,
    transparent: false,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载页面
  if (IS_DEV) {
    mainWindow.loadURL(DEV_URL);
    // 开发模式：打开 DevTools 方便调试
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // 生产模式：加载打包的前端文件
    const webPath = path.join(process.resourcesPath, "web", "index.html");
    mainWindow.loadFile(webPath);
  }

  // 关闭按钮 → 隐藏到托盘（不退出）
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ========================================
// 系统托盘
// ========================================

function createTray(): void {
  // 尝试加载图标文件，按优先级查找
  const iconCandidates = IS_DEV
    ? [
        path.join(__dirname, "..", "icon.ico"),
        path.join(__dirname, "..", "icon.png"),
      ]
    : [
        path.join(process.resourcesPath, "..", "icon.ico"),
        path.join(process.resourcesPath, "icon.ico"),
      ];

  let trayIcon: NativeImage | null = null;

  for (const iconPath of iconCandidates) {
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        trayIcon = img;
        break;
      }
    } catch {
      // 继续尝试下一个
    }
  }

  // 如果所有图标都没找到，创建一个 16x16 的默认图标
  if (!trayIcon || trayIcon.isEmpty()) {
    // 创建一个简单的 16x16 蓝色方块作为默认托盘图标
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4); // RGBA
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4 + 0] = 59;   // R (蓝色色调)
      canvas[i * 4 + 1] = 130;  // G
      canvas[i * 4 + 2] = 246;  // B
      canvas[i * 4 + 3] = 255;  // A
    }
    trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("Letta Chat");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 左键点击 → 切换显示/隐藏
  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
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
  const hasKana = /[\u3040-\u30ff]/.test(text);   // 平假名/片假名 => 日语强特征
  const hasCJK  = /[\u4e00-\u9fff]/.test(text);   // 汉字（中日共用）

  if (hasKana) return "ja";
  if (hasCJK) return "zh";
  return "other";
}

/** 根据源语言决定目标语言 */
function getTargetLang(src: "ja" | "zh" | "other"): string | null {
  if (src === "ja") return "zh"; // 或 "zh-CN"（看你后端支持哪个）
  if (src === "zh") return "ja";
  return null;
}

function registerShortcuts(): void {
  // Alt+Space → 切换聊天窗口 显示/隐藏
  globalShortcut.register("Alt+Space", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

 
  // ✅ Ctrl+B → 自动 Ctrl+C → 翻译选中文本（剪贴板）
  globalShortcut.register("Control+B", async () => {
    try {
      // 1) 记录旧剪贴板（可选：避免无选中文本时污染）
      const prev = clipboard.readText();

      // 2) 模拟 Ctrl+C（复制当前选中文本）
      await keyboard.pressKey(Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.C, Key.LeftControl);

      // 3) 等待系统把选中内容写入剪贴板
      await sleep(120);

      // 4) 读取新的剪贴板
      const text = clipboard.readText().trim();

      // 没复制到内容：恢复旧剪贴板并提示
      if (!text || text === prev) {
        showNotification("翻译", "未检测到选中文本（请先选中内容）");
        return;
      }

     
    // ✅ 自动识别语言并决定目标语言
    const src = detectLang(text);
    const target = getTargetLang(src);

    if (!target) {
      showNotification("翻译", "未识别到中文/日文（请选中文本）");
      return;
    }

    showNotification(
      src === "ja" ? "检测到日语 → 翻译成中文..." : "检测到中文 → 翻译成日语...",
      text.slice(0, 50) + (text.length > 50 ? "..." : "")
    );

    // ✅ 双向翻译：ja -> zh / zh -> ja
    const result = await translateText(text, target, API_BASE);

    clipboard.writeText(result);
    showNotification("翻译完成（已复制）", result);

    mainWindow?.webContents.send("translate-result", {
      original: text,
      translated: result,
      from: src,
      to: target,
    });

    } catch (err: any) {
      showNotification("翻译失败", err?.message || "请检查权限/后端是否运行");
    }
  });
}


// ========================================
// 系统通知
// ========================================

function showNotification(title: string, body: string): void {
  new Notification({ title, body, silent: true }).show();
}

// ========================================
// IPC 事件处理
// ========================================

function setupIPC(): void {
  // 窗口控制（给无边框窗口的自定义标题栏用）
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-close", () => mainWindow?.hide());
  ipcMain.on("window-toggle-top", () => {
    if (!mainWindow) return;
    const isTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isTop);
    mainWindow.webContents.send("always-on-top-changed", !isTop);
  });
}

// ========================================
// App 生命周期
// ========================================

// 单实例锁定：防止多开
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    // 如果用户尝试打开第二个实例，聚焦到已有窗口
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  app.whenReady().then(() => {
    createWindow();
    try {
      createTray();
    } catch (err) {
      console.error("创建系统托盘失败（不影响主窗口）:", err);
    }
    registerShortcuts();
    setupIPC();
    console.log("Letta Chat Desktop 启动成功！");
    console.log(`模式: ${IS_DEV ? "开发" : "生产"}`);
    console.log(`前端: ${IS_DEV ? DEV_URL : "本地文件"}`);
    console.log(`API: ${API_BASE}`);
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    // Windows：关闭所有窗口时不退出（因为有托盘）
  });

  app.on("activate", () => {
    if (!mainWindow) createWindow();
  });
}
