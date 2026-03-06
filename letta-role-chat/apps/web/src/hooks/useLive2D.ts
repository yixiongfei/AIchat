
import { useEffect } from "react";

/**
 * Live2D 控制 hook
 * @param isMobile - 移动端时隐藏
 * @param forceShow - 强制显示（如 Electron 最大化时）
 */
export default function useLive2D(isMobile: boolean, forceShow: boolean = false) {
  const isElectron = !!(window as any).electronAPI?.isElectron;

  useEffect(() => {
    // Electron 最大化时强制显示 Live2D
    if (forceShow) {
      // 移除隐藏样式
      const hideStyle = document.getElementById("live2d-mobile-hide");
      if (hideStyle) hideStyle.remove();

      // 如果还没有注入 Live2D，注入它
      const alreadyInjected =
        Boolean(document.getElementById("live2d-autoload")) ||
        Array.from(document.scripts).some((s) => (s.src || "").includes("live2d-widget")) ||
        (window as any).live2d_path !== undefined;

      if (!alreadyInjected) {
        const script = document.createElement("script");
        script.id = "live2d-autoload";
        script.src =
          "https://cdn.jsdelivr.net/gh/yixiongfei/live2d-widget@master/dist/autoload.js";
        script.async = true;
        document.body.appendChild(script);
      }

      // 确保 Live2D 元素可见
      const widget = document.getElementById("live2d-widget");
      if (widget) (widget as HTMLElement).style.display = "";
      const tips = document.getElementById("live2d-tips");
      if (tips) (tips as HTMLElement).style.display = "";

      return;
    }

    // 移动端或 Electron 普通窗口：隐藏 Live2D
    if (isMobile || isElectron) {
      // 移除 Live2D 相关元素
      const script = document.getElementById("live2d-autoload");
      if (script) script.remove();

      const widget = document.getElementById("live2d-widget");
      if (widget) widget.remove();

      const tips = document.getElementById("live2d-tips");
      if (tips) tips.remove();

      const style = document.createElement("style");
      style.id = "live2d-mobile-hide";
      style.textContent = `
        #live2d-widget,
        #live2d-tips,
        canvas[id^="live2d"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      return;
    }

    // Web 桌面端：移除隐藏样式
    const hideStyle = document.getElementById("live2d-mobile-hide");
    if (hideStyle) hideStyle.remove();

    const alreadyInjected =
      Boolean(document.getElementById("live2d-autoload")) ||
      Array.from(document.scripts).some((s) => (s.src || "").includes("live2d-widget")) ||
      (window as any).live2d_path !== undefined;

    if (alreadyInjected) return;

    const script = document.createElement("script");
    script.id = "live2d-autoload";
    script.src =
      "https://cdn.jsdelivr.net/gh/yixiongfei/live2d-widget@master/dist/autoload.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const existing = document.getElementById("live2d-autoload");
      if (existing) existing.remove();
      const widget = document.getElementById("live2d-widget");
      if (widget) widget.remove();
    };
  }, [isMobile, isElectron, forceShow]);
}
