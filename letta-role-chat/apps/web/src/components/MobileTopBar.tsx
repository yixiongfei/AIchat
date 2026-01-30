
import React from "react";
import { Menu } from "lucide-react";
import { Role } from "../types";

export default function MobileTopBar(props: {
  role: Role;
  autoSpeak: boolean;
  onOpenSidebar: () => void;
  onToggleAutoSpeak: () => void;
  onStop: () => void;
  onClearHistory: () => void;
}) {
  const { role, autoSpeak, onOpenSidebar, onToggleAutoSpeak, onStop, onClearHistory } = props;

  return (
    <div className="shrink-0 px-3 py-2 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur sticky top-0 z-30 md:hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg hover:bg-slate-800/60 text-white transition-colors shrink-0"
          title="打开侧边栏"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {role.avatar ? (
            <img
              src={role.avatar}
              alt={role.name}
              className="h-7 w-7 rounded-full object-cover ring-2 ring-slate-700 shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {role.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs truncate">{role.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onToggleAutoSpeak}
            className={`p-1.5 rounded-md text-base transition-all ${
              autoSpeak ? "bg-blue-600/80 hover:bg-blue-600" : "bg-slate-800/40 hover:bg-slate-800/60"
            }`}
            title={autoSpeak ? "自动朗读：开" : "自动朗读：关"}
          >
            {autoSpeak ? "🔊" : "🔇"}
          </button>

          <button
            onClick={onStop}
            className="p-1.5 rounded-md text-base bg-slate-800/40 hover:bg-slate-800/60 transition-all"
            title="停止"
          >
            ⏹
          </button>

          <button
            onClick={onClearHistory}
            className="p-1.5 rounded-md text-base bg-slate-800/40 hover:bg-slate-800/60 transition-all"
            title="清空历史"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
