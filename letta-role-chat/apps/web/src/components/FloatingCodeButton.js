import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { Code2 } from "lucide-react";
export default function FloatingCodeButton({ togglePanel, }) {
    const buttonRef = useRef(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const origin = useRef({ x: 0, y: 0 });
    const startPointer = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const pointerIdRef = useRef(null);
    useEffect(() => {
        setPosition({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    }, []);
    const clampToViewport = useCallback((x, y) => {
        const el = buttonRef.current;
        if (!el)
            return { x, y };
        const rect = el.getBoundingClientRect();
        return {
            x: Math.min(Math.max(0, x), window.innerWidth - rect.width),
            y: Math.min(Math.max(0, y), window.innerHeight - rect.height),
        };
    }, []);
    const onPointerMove = useCallback((e) => {
        if (!dragging.current)
            return;
        if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current)
            return;
        const dx = e.clientX - startPointer.current.x;
        const dy = e.clientY - startPointer.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
            hasMoved.current = true;
        }
        const newX = e.clientX - origin.current.x;
        const newY = e.clientY - origin.current.y;
        const next = clampToViewport(newX, newY);
        setPosition(next);
        if (e.cancelable) {
            e.preventDefault();
        }
    }, [clampToViewport]);
    const endDrag = useCallback(() => {
        dragging.current = false;
        pointerIdRef.current = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
    }, [onPointerMove]);
    const onPointerDown = useCallback((e) => {
        if (e.button !== 0)
            return;
        dragging.current = true;
        hasMoved.current = false;
        pointerIdRef.current = e.pointerId;
        startPointer.current = { x: e.clientX, y: e.clientY };
        origin.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", endDrag);
        window.addEventListener("pointercancel", endDrag);
    }, [position.x, position.y, onPointerMove, endDrag]);
    const handleClick = useCallback((e) => {
        if (hasMoved.current) {
            e.preventDefault();
            e.stopPropagation();
            hasMoved.current = false;
            return;
        }
        // ✅ 没有拖动，触发 togglePanel
        togglePanel();
    }, [togglePanel]);
    useEffect(() => {
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", endDrag);
            window.removeEventListener("pointercancel", endDrag);
        };
    }, [onPointerMove, endDrag]);
    return (_jsx("button", { ref: buttonRef, onPointerDown: onPointerDown, onClick: handleClick, className: "fixed rounded-full p-3 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-black/30 transition-colors cursor-pointer select-none", style: {
            left: position.x,
            top: position.y,
            zIndex: 9999,
            touchAction: "none",
        }, title: "Toggle Code Panel", "aria-label": "Toggle code panel", children: _jsx(Code2, { size: 20 }) }));
}
