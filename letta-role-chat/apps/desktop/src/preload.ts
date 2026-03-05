import { contextBridge, ipcRenderer } from "electron";

/**
 * 通过 contextBridge 安全地暴露 API 给渲染进程
 * 渲染进程通过 window.electronAPI 调用
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** 标识当前运行在 Electron 中 */
  isElectron: true,

  /** 窗口控制 */
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),
  toggleAlwaysOnTop: () => ipcRenderer.send("window-toggle-top"),

  /** 监听置顶状态变化 */
  onAlwaysOnTopChanged: (callback: (isTop: boolean) => void) => {
    ipcRenderer.on("always-on-top-changed", (_event, isTop) => callback(isTop));
  },

  /** 监听翻译结果 */
  onTranslateResult: (callback: (data: { original: string; translated: string }) => void) => {
    ipcRenderer.on("translate-result", (_event, data) => callback(data));
  },
});
