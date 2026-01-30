
import { useEffect, useState } from "react";

export default function useResizableSidebar(options?: {
  storageKey?: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  disabled?: boolean;
}) {
  const {
    storageKey = "sidebarWidth",
    defaultWidth = 280,
    minWidth = 200,
    maxWidth = 600,
    disabled = false,
  } = options || {};

  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (disabled) return;

    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
        localStorage.setItem(storageKey, String(newWidth));
      }
    };

    const onUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, minWidth, maxWidth, storageKey, disabled]);

  return { width, isResizing, startResize: () => setIsResizing(true) };
}