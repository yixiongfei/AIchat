
import { useRef, useState } from "react";
import { RefreshCw, Moon, Sun, X, Code2 } from "lucide-react";

import { RoleList } from "./components/RoleList";
import { RoleEditor } from "./components/RoleEditor";
import { ChatWindow } from "./components/ChatWindow";

import useIsMobile from "./hooks/useIsMobile";
import useTheme from "./hooks/useTheme";
import useResizableSidebar from "./hooks/useResizableSidebar";
import useLive2D from "./hooks/useLive2D";
import useRoles from "./hooks/useRoles";

import { CodePanelProvider, useCodePanel } from "./codepanel/CodePanelProvider";
import CodePanelHost from "./codepanel/CodePanelHost";
import MobileTopBar from "./components/MobileTopBar";
import FloatingCodeButton from "./components/FloatingCodeButton";

function AppInner() {
  const isMobile = useIsMobile(768);
  const { isDark, toggleTheme } = useTheme();
  useLive2D(isMobile);

  const { width: sidebarWidth, startResize } = useResizableSidebar({
    storageKey: "sidebarWidth",
    defaultWidth: 280,
    minWidth: 200,
    maxWidth: 600,
    disabled: isMobile,
  });

  const {
    roles,
    selectedRole,
    setSelectedRole,
    isSyncing,
    syncRoles,
    createRole,
    updateRole,
  } = useRoles();

  // 移动端侧边栏开关
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  // RoleEditor
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorRole, setEditorRole] = useState<any>(null);

  // ChatWindow ref（移动端顶部栏操作）
  const chatWindowRef = useRef<any>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);

  // CodePanel 布局：为了避免遮挡聊天区，可根据 open/width 给 chat 留出 marginRight
  const { open: codeOpen, width: codeWidth } = useCodePanel();

  const [Open, setOpen] = useState<boolean>(false);
  const handleSelectRole = (role: any) => {
    setSelectedRole(role);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 移动端遮罩 */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 左侧栏 */}
      <div
        className={`
          shrink-0 flex flex-col border-r border-slate-200 bg-slate-50
          dark:border-slate-800 dark:bg-slate-900/40
          transition-transform duration-300 ease-in-out
          ${isMobile ? "fixed inset-y-0 left-0 w-[280px] z-50" : "relative z-0"}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
        style={!isMobile ? { width: `${sidebarWidth}px` } : undefined}
      >
        {/* 顶部栏 */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-bold text-xl text-blue-600 dark:text-blue-400">
            Letta Chat
          </h1>
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 md:hidden"
                title="关闭侧边栏"
              >
                <X size={20} />
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              title={isDark ? "切换到亮色" : "切换到暗色"}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              onClick={syncRoles}
              disabled={isSyncing}
              className={[
                "p-2 rounded-full transition-colors",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                isSyncing ? "animate-spin text-blue-400" : "text-slate-600 dark:text-slate-300",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
              title="Sync from Letta Cloud"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        <RoleList
          roles={roles}
          selectedRoleId={selectedRole?.id}
          onSelectRole={handleSelectRole}
          onCreateClick={() => {
            setEditorRole(null);
            setIsEditorOpen(true);
          }}
          onEditRole={(r) => {
            setEditorRole(r);
            setIsEditorOpen(true);
          }}
        />
      </div>

      {/* 桌面端拖拽分隔条 */}
      {!isMobile && (
        <div
          className="group relative w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/20 transition-colors dark:hover:bg-blue-500/30 z-0"
          onMouseDown={startResize}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute inset-y-0 left-0 w-px bg-slate-300 group-hover:bg-blue-500 transition-colors dark:bg-slate-700 dark:group-hover:bg-blue-400" />
        </div>
      )}

      {/* 右侧聊天区 */}
      <aside
        className="flex-1 min-w-0 h-screen border-l border-slate-800/60 bg-slate-950 text-slate-100 relative flex flex-col"
        style={{
          // ✅ 代码面板打开时给右侧留空间，避免遮挡（以前你在 App 里用 artifactOpen/artifactWidth 做这件事）
          marginRight: !isMobile && codeOpen ? `${codeWidth}px` : undefined,
        }}
      >
        {isMobile && selectedRole && (
          <MobileTopBar
            role={selectedRole}
            autoSpeak={autoSpeak}
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleAutoSpeak={() => chatWindowRef.current?.toggleAutoSpeak?.()}
            onStop={() => chatWindowRef.current?.stopSpeak?.()}
            onClearHistory={() => chatWindowRef.current?.clearHistory?.()}
          />
        )}

        <div className="flex-1 min-h-0">
          {selectedRole ? (
            <ChatWindow
              ref={chatWindowRef}
              role={selectedRole}
              showHeader={!isMobile}
              defaultAutoSpeak={autoSpeak}
              onAutoSpeakChange={setAutoSpeak}
              headerClassName="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur sticky top-0 z-10"
              bodyClassName="bg-gradient-to-b from-slate-950 to-slate-950"
              bodyInnerClassName="max-w-[1000px]"
              inputBarClassName="border-t border-slate-800/60 bg-slate-950/70 backdrop-blur"
              inputClassName="
                bg-slate-900/60 text-slate-100 ring-1 ring-slate-700/50
                placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/60
              "
              sendButtonClassName="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              userBubbleClassName="bg-blue-600 text-white"
              assistantBubbleClassName="bg-slate-900/70 text-slate-100 ring-1 ring-slate-800"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              请选择一个角色
            </div>
          )}
        </div>
      </aside>

      {/* RoleEditor */}
      {isEditorOpen && (
        <RoleEditor
          initialRole={editorRole ?? undefined}
          onSave={
            editorRole
              ? (data) => updateRole(editorRole.id, data).then(() => {
                  setIsEditorOpen(false);
                  setEditorRole(null);
                })
              : (data) => createRole(data).then(() => setIsEditorOpen(false))
          }
          onClose={() => {
            setIsEditorOpen(false);
            setEditorRole(null);
          }}
        />
      )}

      {/* ✅ 全局代码面板 Host（唯一实例） */}
      <CodePanelHost />

      {/* ✅ 浮动按钮（控制同一个面板） */}
      <FloatingCodeButton togglePanel={() => setOpen(prev => !prev)} />
    </div>
  );
}

export default function App() {
  return (
    <CodePanelProvider>
      <AppInner />
    </CodePanelProvider>
  );
}
