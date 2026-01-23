
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useTTS, { type RoleTTSConfig } from "./useTTS";

type SelectionInfo = {
  text: string;
  rect: DOMRect | null;
};

type Options = {
  maxLen?: number;
  clearNativeSelectionOnClear?: boolean;
  enableSelectionChange?: boolean; // 是否启用 selectionchange（默认启用+节流）
};

export function useTextSelectionTTS(
  containerRef: React.RefObject<HTMLElement>,
  roleConfig: RoleTTSConfig,
  options: Options = {}
) {
  const {
    maxLen = 500,
    clearNativeSelectionOnClear = false,
    enableSelectionChange = true,
  } = options;

  const [sel, setSel] = useState<SelectionInfo>({ text: "", rect: null });
  const [loading, setLoading] = useState(false);

  // selectionchange RAF 节流
  const rafIdRef = useRef<number | null>(null);

  // 去重：避免同样文本频繁 setState
  const lastTextRef = useRef<string>("");

  const normalize = useCallback((s: string) => s.replace(/\s+/g, " ").trim(), []);

  const clear = useCallback(() => {
    setSel({ text: "", rect: null });
    lastTextRef.current = "";

    if (clearNativeSelectionOnClear && typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, [clearNativeSelectionOnClear]);

  // ✅ 稳定 roleConfig（避免外部每次传新对象导致 useTTS 重建）
  const stableRoleConfig = useMemo(
    () => roleConfig,
    [roleConfig.voice, roleConfig.speed, roleConfig.pitch, roleConfig.style]
  );

  const { enqueue, stop } = useTTS(stableRoleConfig);

  const updateSelection = useCallback(() => {
    if (typeof window === "undefined") return;

    const el = containerRef.current;
    if (!el) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return clear();
    if (selection.isCollapsed) return clear();

    const range = selection.getRangeAt(0);

    // 选区是否在容器内
    const common = range.commonAncestorContainer;
    const commonEl =
      common.nodeType === 1 ? (common as Element) : (common.parentElement ?? null);

    if (!commonEl || !el.contains(commonEl)) return clear();

    const text = normalize(selection.toString());
    if (!text) return clear();

    const finalText = text.length > maxLen ? text.slice(0, maxLen) : text;

    // 去重：文本没变就不更新
    if (finalText === lastTextRef.current) return;

    const rect = range.getBoundingClientRect();
    lastTextRef.current = finalText;
    setSel({ text: finalText, rect });
  }, [containerRef, clear, normalize, maxLen]);

  const scheduleUpdate = useCallback(() => {
    if (!enableSelectionChange) return;
    if (typeof window === "undefined") return;

    if (rafIdRef.current != null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      updateSelection();
    });
  }, [enableSelectionChange, updateSelection]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMouseUp = () => updateSelection();
    const onKeyUp = () => updateSelection();
    const onPointerUp = () => updateSelection();
    const onTouchEnd = () => updateSelection();

    const onSelectionChange = () => scheduleUpdate();

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onTouchEnd);

    if (enableSelectionChange) {
      document.addEventListener("selectionchange", onSelectionChange);
    }

    // 滚动时清除（避免 rect 错位）
    const onScroll = () => clear();
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onTouchEnd);

      if (enableSelectionChange) {
        document.removeEventListener("selectionchange", onSelectionChange);
      }

      window.removeEventListener("scroll", onScroll, true);

      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [updateSelection, scheduleUpdate, clear, enableSelectionChange]);

  // ✅ speak：按 useTTS.ts 的签名 enqueue(message: string)
  const speak = useCallback(async () => {
    if (!sel.text) return;

    setLoading(true);
    try {
      await Promise.resolve(enqueue(sel.text)); // enqueue 接收 string
    } finally {
      setLoading(false);
    }
  }, [sel.text, enqueue]);

  const stopSpeak = useCallback(() => {
    stop();
    setLoading(false);
  }, [stop]);

  return { sel, loading, speak, stopSpeak, clear };
}
