import { useRef, useState, useCallback } from "react";
import { RefreshCw, Moon, Sun, X } from "lucide-react";

import { RoleList } from "./components/RoleList";
import { RoleEditor } from "./components/RoleEditor";
import { ChatWindow } from "./components/ChatWindow";
import ChatList from "./components/ChatList";

import useIsMobile from "./hooks/useIsMobile";
import useTheme from "./hooks/useTheme";
import useResizableSidebar from "./hooks/useResizableSidebar";
import useLive2D from "./hooks/useLive2D";
import useRoles from "./hooks/useRoles";

import { CodePanelProvider, useCodePanel } from "./codepanel/CodePanelProvider";
import CodePanelHost from "./codepanel/CodePanelHost";
import MobileTopBar from "./components/MobileTopBar";
import FloatingCodeButton from "./components/FloatingCodeButton";

import type { Chat } from "./types";
import { api } from "./services/api";

function AppInner() {
  const isMobile = useIsMobile(768);
  const { isDark, toggleTheme } = useTheme();
  useLive2D(isMobile);

  const { width: sidebarWidth, startResize } = useResizableSidebar({
    storageKey: "sidebarWidth",
    defaultWidth: 280,
    minWidth: 60,
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

  // ✅ Chat 状态管理
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chatListKey, setChatListKey] = useState(0);

  // ✅ 从 CodePanel Context 获取状态和控制函数
  const { open: codeOpen, width: codeWidth, togglePanel } = useCodePanel();

  const handleSelectRole = (role: any) => {
    setSelectedRole(role);
    setSelectedChat(null); // 切换 agent 时重置选中的 chat
    if (isMobile) setSidebarOpen(false);
  };

  // ✅ 新建 Chat
  const handleNewChat = useCallback(async () => {
    if (!selectedRole) return;
    try {
      const chat = await api.createChat(selectedRole.id);
      setSelectedChat(chat);
      setChatListKey((k) => k + 1); // 刷新列表
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  }, [selectedRole]);

  // ✅ 选择 Chat
  const handleSelectChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // ✅ 刷新 Chat 列表（发送消息后调用）
  const refreshChatList = useCallback(() => {
    setChatListKey((k) => k + 1);
  }, []);

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
          transition-all duration-300 ease-in-out
          ${isMobile ? "fixed inset-y-0 left-0 w-[280px] z-50" : "relative z-0"}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
        style={!isMobile ? { width: `${sidebarWidth}px` } : undefined}
      >
        {/* 顶部按钮栏 */}
        <div className="p-2 border-b border-slate-200 flex items-center justify-center gap-2 bg-white dark:border-slate-800 dark:bg-slate-900">
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
          isCollapsed={sidebarWidth < 120}
        />

        {/* ✅ Chat 列表 - 在选中 Agent 后显示 */}
        {selectedRole && (
          <div className="border-t border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-hidden">
            <ChatList
              key={chatListKey}
              agentId={selectedRole.id}
              selectedChatId={selectedChat?.id}
              onSelectChat={handleSelectChat}
              onNewChat={handleNewChat}
              isCollapsed={sidebarWidth < 120}
            />
          </div>
        )}
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
        className="flex-1 min-w-0 h-screen border-l border-slate-200 bg-white text-slate-900 dark:border-slate-800/60 dark:bg-slate-950 dark:text-slate-100 relative flex flex-col"
        style={{
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
              chatId={selectedChat?.id}
              onMessageSent={refreshChatList}
              showHeader={!isMobile}
              defaultAutoSpeak={autoSpeak}
              onAutoSpeakChange={setAutoSpeak}
              headerClassName="border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10 dark:border-slate-800/60 dark:bg-slate-950/70"
              bodyClassName="bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-950"
              bodyInnerClassName="max-w-[1000px]"
              inputBarClassName="border-t border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/70"
              inputClassName="
                bg-white text-slate-900 ring-1 ring-slate-300
                placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/60
                dark:bg-slate-900/60 dark:text-slate-100 dark:ring-slate-700/50
              "
              sendButtonClassName="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              userBubbleClassName="bg-blue-600 text-white"
              assistantBubbleClassName="bg-slate-100 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-slate-800"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
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

      {/* ✅ 浮动按钮 - 直接传递 Context 中的 togglePanel */}
      <FloatingCodeButton togglePanel={togglePanel} />
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