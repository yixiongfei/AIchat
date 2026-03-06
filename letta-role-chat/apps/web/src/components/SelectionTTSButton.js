import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTextSelectionTTS } from '../hooks/useTextSelectionTTS';
export default function SelectionTTSButton({ containerRef, roleConfig }) {
    const { sel, loading, speak, clear } = useTextSelectionTTS(containerRef, roleConfig);
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ left: 0, top: 0 });
    useEffect(() => {
        if (sel.text && sel.rect) {
            // position near the top-right of selection rect, adjust for page scroll
            const scrollY = window.scrollY || window.pageYOffset;
            const left = Math.max(8, sel.rect.right + window.scrollX - 28);
            const top = Math.max(8, sel.rect.top + scrollY - 36);
            setPos({ left, top });
            setVisible(true);
        }
        else {
            setVisible(false);
        }
    }, [sel]);
    if (!visible)
        return null;
    return (_jsx("div", { className: "fixed z-50", style: { left: pos.left, top: pos.top }, children: _jsx("button", { onClick: async () => {
                try {
                    await speak();
                }
                catch (e) {
                    console.error('TTS speak error', e);
                }
                finally {
                    // 隐藏但保留选区（可选改为 clear()）
                    clear();
                }
            }, className: "inline-flex items-center gap-2 rounded-md bg-black/75 text-white px-3 py-1 text-sm shadow-lg hover:bg-black/90", title: `朗读：${sel.text.slice(0, 60)}${sel.text.length > 60 ? '…' : ''}`, children: loading ? (_jsx("span", { className: "animate-pulse", children: "\uD83D\uDD0A \u8BFB\u53D6\u4E2D" })) : (_jsx("span", { children: "\uD83D\uDD0A \u6717\u8BFB" })) }) }));
}
