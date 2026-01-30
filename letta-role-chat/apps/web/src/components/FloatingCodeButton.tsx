import React, { useCallback, useEffect, useRef, useState } from "react";
import { Code2 } from "lucide-react";

type Pos = { x: number; y: number };

export default function FloatingCodeButton({
  togglePanel,
}: {
  togglePanel: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<Pos>({ x: 0, y: 0 });

  const dragging = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    setPosition({ x: window.innerWidth - 60, y: window.innerHeight - 60 });
  }, []);

  const clampToViewport = useCallback((x: number, y: number) => {
    const el = buttonRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, x), window.innerWidth - rect.width),
      y: Math.min(Math.max(0, y), window.innerHeight - rect.height),
    };
  }, []);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return;
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;

      const newX = e.clientX - origin.current.x;
      const newY = e.clientY - origin.current.y;

      const next = clampToViewport(newX, newY);
      setPosition(next);

      const dx = e.clientX - startPointer.current.x;
      const dy = e.clientY - startPointer.current.y;
      if (dx * dx + dy * dy > 36) moved.current = true; // 6px 阈值

      // 只有在拖动过程中才阻止默认行为（避免滚动）
      if (moved.current && e.cancelable) e.preventDefault();
    },
    [clampToViewport]
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
    pointerIdRef.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;

      dragging.current = true;
      moved.current = false;
      pointerIdRef.current = e.pointerId;

      startPointer.current = { x: e.clientX, y: e.clientY };
      origin.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };

      e.currentTarget.setPointerCapture(e.pointerId);

      // ❗️不要在这里 preventDefault，否则移动端 click 可能失效
      window.addEventListener("pointermove", onPointerMove, { passive: false });
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [position.x, position.y, onPointerMove, endDrag]
  );

  // 如果刚拖动过，就吞掉 click，避免“拖完松手还触发打开”
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
      moved.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [onPointerMove, endDrag]);

  return (
    <button
      ref={buttonRef}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onClick={togglePanel}
      className="fixed rounded-full p-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-black/30 transition-transform active:scale-95"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 60,
        touchAction: "none",
      }}
      title="Open Code Panel"
    >
      <Code2 size={20} />
    </button>
  );
}