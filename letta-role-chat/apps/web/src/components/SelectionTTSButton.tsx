import React, { useEffect, useState } from 'react';
import { useTextSelectionTTS } from '../hooks/useTextSelectionTTS';

interface Props {
  containerRef: React.RefObject<HTMLElement>;
    roleConfig: {
    voice?: string;
    speed?: number;
    pitch?: string;
    style?: string;
    };
}

export default function SelectionTTSButton({ containerRef, roleConfig }: Props) {
  const { sel, loading, speak, clear } = useTextSelectionTTS(containerRef, roleConfig);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  useEffect(() => {
    if (sel.text && sel.rect) {
      // position near the top-right of selection rect, adjust for page scroll
      const scrollY = window.scrollY || window.pageYOffset;
      const left = Math.max(8, sel.rect.right + window.scrollX - 28);
      const top = Math.max(8, sel.rect.top + scrollY - 36);
      setPos({ left, top });
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [sel]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-50"
      style={{ left: pos.left, top: pos.top }}
    >
      <button
        onClick={async () => {
          try {
            await speak();
          } catch (e) {
            console.error('TTS speak error', e);
          } finally {
            // 隐藏但保留选区（可选改为 clear()）
            clear();
          }
        }}
        className="inline-flex items-center gap-2 rounded-md bg-black/75 text-white px-3 py-1 text-sm shadow-lg hover:bg-black/90"
        title={`朗读：${sel.text.slice(0, 60)}${sel.text.length > 60 ? '…' : ''}`}
      >
        {loading ? (<span className="animate-pulse">🔊 读取中</span>) : (<span>🔊 朗读</span>)}
      </button>
    </div>
  );
}
