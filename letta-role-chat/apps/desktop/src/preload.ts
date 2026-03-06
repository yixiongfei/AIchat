import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  /** 标识当前运行在 Electron 中 */
  isElectron: true,

  /** 窗口控制 */
  minimize: () => ipcRenderer.send("window-minimize"),
  close: () => ipcRenderer.send("window-close"),
  maximize: () => ipcRenderer.send("window-maximize"),
  toggleAlwaysOnTop: () => ipcRenderer.send("window-toggle-top"),

  /** 监听窗口状态变化 */
  onAlwaysOnTopChanged: (callback: (isTop: boolean) => void) => {
    ipcRenderer.on("always-on-top-changed", (_event, isTop) => callback(isTop));
  },
  onMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("maximized-changed", (_event, isMax) => callback(isMax));
  },

  /** 监听翻译结果 */
  onTranslateResult: (callback: (data: { original: string; translated: string }) => void) => {
    ipcRenderer.on("translate-result", (_event, data) => callback(data));
  },
});
