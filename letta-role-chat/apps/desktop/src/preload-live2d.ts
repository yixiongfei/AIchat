import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("live2dAPI", {
  /** 双击 Live2D 恢复主窗口 */
  restoreMainWindow: () => ipcRenderer.send("live2d-restore"),
  /** 控制鼠标穿透（透明区域点击穿透） */
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send("live2d-set-ignore-mouse", ignore),
  /** 监听全屏光标位置（主进程轮询转发） */
  onCursorMove: (callback: (pos: { x: number; y: number }) => void) => {
    ipcRenderer.on("cursor-move", (_event, pos) => callback(pos));
  },
});
