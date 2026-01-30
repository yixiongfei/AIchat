
import { useEffect } from "react";

export default function useLive2D(isMobile: boolean) {
  useEffect(() => {
    if (isMobile) {
      // 移动端：移除 Live2D 相关元素
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

    // 桌面端：移除隐藏样式
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
  }, [isMobile]);
}
