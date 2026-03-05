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
    height: 620,
    minWidth: 320,
    minHeight: 400,
    frame: false,           // 无边框
    alwaysOnTop: true,      // 始终置顶
    resizable: true,        // 可拖拽缩放
    skipTaskbar: false,     // 在任务栏显示
    show: true,
    transparent: false,
    backgroundColor: "#0f172a", // slate-900 背景
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

  // Ctrl+Shift+T → 翻译剪贴板中文 → 日文
  globalShortcut.register("Ctrl+Shift+T", async () => {
    const text = clipboard.readText().trim();
    if (!text) {
      showNotification("翻译", "剪贴板为空");
      return;
    }

    // 检查是否包含中文
    if (!/[\u4e00-\u9fff]/.test(text)) {
      showNotification("翻译", "剪贴板内容不包含中文");
      return;
    }

    showNotification("翻译中...", text.slice(0, 50) + (text.length > 50 ? "..." : ""));

    try {
      const result = await translateText(text, "ja", API_BASE);
      // 写回剪贴板
      clipboard.writeText(result);
      showNotification("翻译完成（已复制）", result);

      // 通知渲染进程（可选）
      mainWindow?.webContents.send("translate-result", { original: text, translated: result });
    } catch (err: any) {
      showNotification("翻译失败", err.message || "请检查后端是否运行");
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
