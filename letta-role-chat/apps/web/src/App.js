import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState, useCallback, useEffect } from "react";
import { RefreshCw, Moon, Sun, X, Maximize2, Minimize2 } from "lucide-react";
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
import { api } from "./services/api";
function AppInner() {
    // 检测 Electron 环境（需要在其他 hooks 之前）
    const isElectron = !!window.electronAPI?.isElectron;
    const [isMaximized, setIsMaximized] = useState(false);
    // 监听 Electron 窗口最大化状态变化
    useEffect(() => {
        if (!isElectron)
            return;
        const api = window.electronAPI;
        api?.onMaximizedChanged?.((maximized) => {
            setIsMaximized(maximized);
        });
    }, [isElectron]);
    const isMobile = useIsMobile(768);
    const { isDark, toggleTheme } = useTheme();
    useLive2D(isMobile, isElectron && isMaximized);
    const { width: sidebarWidth, startResize } = useResizableSidebar({
        storageKey: "sidebarWidth",
        defaultWidth: 280,
        minWidth: 60,
        maxWidth: 600,
        disabled: isMobile,
    });
    const { roles, selectedRole, setSelectedRole, isSyncing, syncRoles, createRole, updateRole, } = useRoles();
    // 移动端 / Electron 桌面端侧边栏默认关闭
    const [sidebarOpen, setSidebarOpen] = useState(!isMobile && !isElectron);
    // RoleEditor
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorRole, setEditorRole] = useState(null);
    // ChatWindow ref（移动端顶部栏操作）
    const chatWindowRef = useRef(null);
    const [autoSpeak, setAutoSpeak] = useState(false);
    // ✅ Chat 状态管理
    const [selectedChat, setSelectedChat] = useState(null);
    const [chatListKey, setChatListKey] = useState(0);
    // ✅ 从 CodePanel Context 获取状态和控制函数
    const { open: codeOpen, width: codeWidth, togglePanel } = useCodePanel();
    const handleSelectRole = (role) => {
        setSelectedRole(role);
        setSelectedChat(null); // 切换 agent 时重置选中的 chat
        if (isMobile)
            setSidebarOpen(false);
    };
    // ✅ 新建 Chat
    // 逻辑：创建新的空对话并切换到它
    const handleNewChat = useCallback(async () => {
        if (!selectedRole)
            return;
        try {
            const newChat = await api.createChat(selectedRole.id);
            setSelectedChat(newChat);
            setChatListKey((k) => k + 1); // 刷新列表
        }
        catch (error) {
            console.error("Failed to create chat:", error);
        }
    }, [selectedRole]);
    // ✅ 选择 Chat
    const handleSelectChat = useCallback((chat) => {
        setSelectedChat(chat);
        if (isMobile)
            setSidebarOpen(false);
    }, [isMobile]);
    // ✅ 刷新 Chat 列表（发送消息后调用）
    const refreshChatList = useCallback(() => {
        setChatListKey((k) => k + 1);
    }, []);
    return (_jsxs("div", { className: "flex flex-col h-full min-h-0 overflow-hidden font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100", children: [isElectron && (_jsxs("div", { className: "shrink-0 h-8 flex items-center justify-between px-2 bg-slate-100 dark:bg-slate-900 select-none", style: { WebkitAppRegion: "drag" }, children: [_jsx("span", { className: "text-xs text-slate-400 dark:text-slate-500 pl-1", children: "Letta Chat" }), _jsxs("div", { className: "flex items-center gap-1", style: { WebkitAppRegion: "no-drag" }, children: [_jsx("button", { onClick: () => window.electronAPI?.minimize(), className: "w-6 h-6 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 flex items-center justify-center", title: "\u6700\u5C0F\u5316", children: _jsx("svg", { width: "10", height: "1", viewBox: "0 0 10 1", children: _jsx("rect", { width: "10", height: "1", fill: "currentColor" }) }) }), _jsx("button", { onClick: () => window.electronAPI?.maximize(), className: "w-6 h-6 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400 flex items-center justify-center", title: isMaximized ? "还原" : "最大化", children: isMaximized ? _jsx(Minimize2, { size: 12 }) : _jsx(Maximize2, { size: 12 }) }), _jsx("button", { onClick: () => window.electronAPI?.close(), className: "w-6 h-6 rounded hover:bg-red-500 hover:text-white transition-colors text-slate-500 dark:text-slate-400 flex items-center justify-center", title: "\u5173\u95ED", children: _jsx(X, { size: 12 }) })] })] })), _jsxs("div", { className: "flex flex-1 overflow-hidden", children: [isMobile && sidebarOpen && (_jsx("div", { className: "fixed inset-0 bg-black/50 z-40 md:hidden", onClick: () => setSidebarOpen(false) })), _jsxs("div", { className: `
          shrink-0 flex flex-col border-r border-slate-200 bg-slate-50
          dark:border-slate-800 dark:bg-slate-900/40
          transition-all duration-300 ease-in-out
          ${isMobile ? "fixed inset-y-0 left-0 w-[280px] z-50" : "relative z-0"}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `, style: !isMobile ? { width: `${sidebarWidth}px` } : undefined, children: [_jsxs("div", { className: "p-2 border-b border-slate-200 flex items-center justify-center gap-2 app-no-drag bg-white dark:border-slate-800 dark:bg-slate-900", children: [isMobile && (_jsx("button", { onClick: () => setSidebarOpen(false), className: "p-2 rounded-full app-no-drag hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 md:hidden", title: "\u5173\u95ED\u4FA7\u8FB9\u680F", children: _jsx(X, { size: 20 }) })), _jsx("button", { onClick: toggleTheme, className: "p-2 rounded-full app-no-drag hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300", title: isDark ? "切换到亮色" : "切换到暗色", children: isDark ? _jsx(Sun, { size: 20 }) : _jsx(Moon, { size: 20 }) }), _jsx("button", { onClick: syncRoles, disabled: isSyncing, className: [
                                            "p-2 rounded-full transition-colors",
                                            "hover:bg-slate-100 dark:hover:bg-slate-800",
                                            isSyncing ? "animate-spin text-blue-400" : "text-slate-600 dark:text-slate-300",
                                            "disabled:opacity-60 disabled:cursor-not-allowed",
                                        ].join(" "), title: "Sync from Letta Cloud", children: _jsx(RefreshCw, { size: 20 }) })] }), _jsx(RoleList, { roles: roles, selectedRoleId: selectedRole?.id, onSelectRole: handleSelectRole, onCreateClick: () => {
                                    setEditorRole(null);
                                    setIsEditorOpen(true);
                                }, onEditRole: (r) => {
                                    setEditorRole(r);
                                    setIsEditorOpen(true);
                                }, isCollapsed: sidebarWidth < 120 }), selectedRole && (_jsx("div", { className: "border-t border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-hidden", children: _jsx(ChatList, { agentId: selectedRole.id, selectedChatId: selectedChat?.id, onSelectChat: handleSelectChat, onNewChat: handleNewChat, isCollapsed: sidebarWidth < 120 }, chatListKey) }))] }), !isMobile && (_jsxs("div", { className: "group relative w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/20 transition-colors dark:hover:bg-blue-500/30 z-0", onMouseDown: startResize, children: [_jsx("div", { className: "absolute inset-y-0 -left-1 -right-1" }), _jsx("div", { className: "absolute inset-y-0 left-0 w-px bg-slate-300 group-hover:bg-blue-500 transition-colors dark:bg-slate-700 dark:group-hover:bg-blue-400" })] })), _jsxs("aside", { className: "flex-1 min-w-0 h-full min-h-0 border-l border-slate-200 bg-white text-slate-900 dark:border-slate-800/60 dark:bg-slate-950 dark:text-slate-100 relative flex flex-col", style: {
                            marginRight: !isMobile && codeOpen ? `${codeWidth}px` : undefined,
                        }, children: [isMobile && selectedRole && (_jsx(MobileTopBar, { role: selectedRole, autoSpeak: autoSpeak, onOpenSidebar: () => setSidebarOpen(true), onToggleAutoSpeak: () => chatWindowRef.current?.toggleAutoSpeak?.(), onStop: () => chatWindowRef.current?.stopSpeak?.(), onClearHistory: () => chatWindowRef.current?.clearHistory?.() })), _jsx("div", { className: "flex-1 min-h-0", children: selectedRole ? (_jsx(ChatWindow, { ref: chatWindowRef, role: selectedRole, chatId: selectedChat?.id, onMessageSent: refreshChatList, showHeader: !isMobile, defaultAutoSpeak: autoSpeak, onAutoSpeakChange: setAutoSpeak, headerClassName: "border-b border-slate-200 bg-white/70 backdrop-blur sticky top-0 z-10 dark:border-slate-800/60 dark:bg-slate-950/70", bodyClassName: "bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-950", bodyInnerClassName: "max-w-[1000px]", inputBarClassName: "border-t border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/70", inputClassName: "\r\n                bg-white text-slate-900 ring-1 ring-slate-300\r\n                placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/60\r\n                dark:bg-slate-900/60 dark:text-slate-100 dark:ring-slate-700/50\r\n              ", sendButtonClassName: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm", userBubbleClassName: "bg-blue-600 text-white", assistantBubbleClassName: "bg-slate-100 text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-slate-800" })) : (_jsx("div", { className: "h-full flex items-center justify-center text-slate-500 dark:text-slate-400", children: "\u8BF7\u9009\u62E9\u4E00\u4E2A\u89D2\u8272" })) })] }), isEditorOpen && (_jsx(RoleEditor, { initialRole: editorRole ?? undefined, onSave: editorRole
                            ? (data) => updateRole(editorRole.id, data).then(() => {
                                setIsEditorOpen(false);
                                setEditorRole(null);
                            })
                            : (data) => createRole(data).then(() => setIsEditorOpen(false)), onClose: () => {
                            setIsEditorOpen(false);
                            setEditorRole(null);
                        } })), _jsx(CodePanelHost, {}), _jsx(FloatingCodeButton, { togglePanel: togglePanel })] })] }));
}
export default function App() {
    return (_jsx(CodePanelProvider, { children: _jsx(AppInner, {}) }));
}
