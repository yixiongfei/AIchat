import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/ChatList.tsx
import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Plus, Trash2, Edit2, ChevronDown, ChevronRight, Check, X, Loader2, } from "lucide-react";
import { api } from "../services/api";
const cn = (...classes) => classes.filter(Boolean).join(" ");
/** 格式化时间显示 */
function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 7) {
        return new Date(timestamp).toLocaleDateString("zh-CN", {
            month: "short",
            day: "numeric",
        });
    }
    if (days > 0)
        return `${days}天前`;
    if (hours > 0)
        return `${hours}小时前`;
    if (minutes > 0)
        return `${minutes}分钟前`;
    return "刚刚";
}
/** 截断文本 */
function truncate(text, maxLen) {
    if (!text)
        return "";
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen) + "...";
}
export default function ChatList({ agentId, selectedChatId, onSelectChat, onNewChat, isCollapsed = false, }) {
    const [chats, setChats] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isExpanded, setIsExpanded] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    // 获取聊天列表
    const fetchChats = useCallback(async () => {
        if (!agentId)
            return;
        setIsLoading(true);
        try {
            const data = await api.getChats(agentId, searchQuery || undefined);
            // 防御性处理：确保 chats 始终为数组
            setChats(Array.isArray(data?.chats) ? data.chats : []);
        }
        catch (error) {
            console.error("Failed to fetch chats:", error);
            setChats([]); // 出错时重置为空数组
        }
        finally {
            setIsLoading(false);
        }
    }, [agentId, searchQuery]);
    useEffect(() => {
        fetchChats();
    }, [fetchChats]);
    // 搜索防抖
    const [debouncedSearch, setDebouncedSearch] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);
    useEffect(() => {
        if (debouncedSearch !== searchQuery)
            return;
        fetchChats();
    }, [debouncedSearch]);
    // 删除聊天
    const handleDelete = useCallback(async (e, chatId) => {
        e.stopPropagation();
        if (!confirm("确定要删除这个对话吗？"))
            return;
        try {
            await api.deleteChat(chatId);
            setChats((prev) => prev.filter((c) => c.id !== chatId));
        }
        catch (error) {
            console.error("Failed to delete chat:", error);
        }
    }, []);
    // 开始编辑标题
    const startEdit = useCallback((e, chat) => {
        e.stopPropagation();
        setEditingId(chat.id);
        setEditTitle(chat.title);
    }, []);
    // 保存标题
    const saveTitle = useCallback(async (chatId) => {
        if (!editTitle.trim()) {
            setEditingId(null);
            return;
        }
        try {
            await api.updateChat(chatId, editTitle.trim());
            setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, title: editTitle.trim() } : c));
        }
        catch (error) {
            console.error("Failed to update chat title:", error);
        }
        finally {
            setEditingId(null);
        }
    }, [editTitle]);
    // 取消编辑
    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditTitle("");
    }, []);
    // 处理键盘事件
    const handleKeyDown = useCallback((e, chatId) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveTitle(chatId);
        }
        else if (e.key === "Escape") {
            cancelEdit();
        }
    }, [saveTitle, cancelEdit]);
    // 折叠模式下显示对话图标列表（类似 Agent 列表）
    if (isCollapsed) {
        return (_jsxs("div", { className: "flex flex-col items-center py-2 border-t border-slate-200 dark:border-slate-800", children: [_jsx("div", { className: "w-6 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full mb-2" }), _jsx("div", { className: "flex flex-col items-center gap-1 w-full overflow-y-auto max-h-[40vh] scrollbar-hide", children: isLoading ? (_jsx("div", { className: "py-2", children: _jsx(Loader2, { size: 18, className: "animate-spin text-slate-400" }) })) : chats.length === 0 ? (_jsx("div", { className: "py-2", children: _jsx(MessageSquare, { size: 20, className: "text-slate-400" }) })) : (chats.map((chat, index) => {
                        const isActive = selectedChatId === chat.id;
                        return (_jsx("button", { onClick: () => onSelectChat(chat), className: cn("w-full py-2 flex justify-center transition-colors rounded-xl mx-1", "hover:bg-slate-100 dark:hover:bg-slate-800/60", isActive && "bg-slate-200 dark:bg-slate-800"), title: chat.title, children: _jsxs("div", { className: "relative", children: [_jsx(MessageSquare, { size: 22, className: cn(isActive
                                            ? "text-blue-500 dark:text-blue-400"
                                            : "text-slate-400 dark:text-slate-500") }), _jsx("span", { className: cn("absolute -bottom-1 -right-1 text-[9px] font-medium w-3.5 h-3.5 flex items-center justify-center rounded-full", isActive
                                            ? "bg-blue-500 text-white"
                                            : "bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300"), children: index + 1 })] }) }, chat.id));
                    })) })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx("div", { className: "p-2 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70", children: _jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("button", { onClick: () => setIsExpanded(!isExpanded), className: "flex items-center gap-2 flex-1 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-md px-2 py-1 transition-colors", children: [isExpanded ? _jsx(ChevronDown, { size: 16 }) : _jsx(ChevronRight, { size: 16 }), _jsx("h3", { className: "font-semibold text-slate-700 dark:text-slate-200", children: "\u5BF9\u8BDD" }), chats.length > 0 && (_jsx("span", { className: "text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded", children: chats.length }))] }), _jsx("button", { onClick: onNewChat, className: "p-2 rounded-lg transition-colors bg-green-500/10 hover:bg-green-500/20 active:scale-[0.98] dark:bg-green-500/10 dark:hover:bg-green-500/20", title: "\u65B0\u5EFA\u5BF9\u8BDD", children: _jsx(Plus, { size: 18, className: "text-green-600 dark:text-green-400" }) })] }) }), isExpanded && (_jsx("div", { className: "flex-1 overflow-y-auto py-2", children: isLoading ? (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsx(Loader2, { size: 20, className: "animate-spin text-slate-400" }) })) : chats.length === 0 ? (_jsx("div", { className: "px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400", children: searchQuery ? "没有找到匹配的对话" : "暂无对话，点击 + 新建" })) : (chats.map((chat) => {
                    const isActive = selectedChatId === chat.id;
                    const isEditing = editingId === chat.id;
                    return (_jsx("div", { onClick: () => !isEditing && onSelectChat(chat), className: cn("group mx-2 mb-1 px-3 py-2 rounded-xl cursor-pointer transition-colors", "hover:bg-slate-100 dark:hover:bg-slate-800/60", isActive && "bg-slate-200 dark:bg-slate-800"), children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(MessageSquare, { size: 16, className: cn("shrink-0 mt-0.5", isActive
                                        ? "text-blue-500"
                                        : "text-slate-400 dark:text-slate-500") }), _jsx("div", { className: "flex-1 min-w-0", children: isEditing ? (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "text", value: editTitle, onChange: (e) => setEditTitle(e.target.value), onKeyDown: (e) => handleKeyDown(e, chat.id), onBlur: () => saveTitle(chat.id), placeholder: "\u8F93\u5165\u5BF9\u8BDD\u6807\u9898", title: "\u5BF9\u8BDD\u6807\u9898", className: "flex-1 px-1.5 py-0.5 text-sm rounded\r\n                              bg-white dark:bg-slate-700\r\n                              border border-slate-300 dark:border-slate-600\r\n                              focus:outline-none focus:ring-1 focus:ring-blue-500", autoFocus: true, onClick: (e) => e.stopPropagation() }), _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    saveTitle(chat.id);
                                                }, className: "p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded", title: "\u4FDD\u5B58\u6807\u9898", "aria-label": "\u4FDD\u5B58\u6807\u9898", children: _jsx(Check, { size: 14, className: "text-green-600" }) }), _jsx("button", { onClick: (e) => {
                                                    e.stopPropagation();
                                                    cancelEdit();
                                                }, className: "p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded", title: "\u53D6\u6D88\u7F16\u8F91", "aria-label": "\u53D6\u6D88\u7F16\u8F91", children: _jsx(X, { size: 14, className: "text-red-500" }) })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "font-medium text-sm truncate text-slate-800 dark:text-slate-200", children: chat.title }), chat.last_message && (_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5", children: truncate(chat.last_message, 40) })), _jsxs("p", { className: "text-xs text-slate-400 dark:text-slate-500 mt-1", children: [formatTime(chat.updated_at), chat.message_count !== undefined && (_jsxs("span", { className: "ml-2", children: [chat.message_count, " \u6761\u6D88\u606F"] }))] })] })) }), !isEditing && (_jsxs("div", { className: "shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("button", { onClick: (e) => startEdit(e, chat), className: "p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded", title: "\u7F16\u8F91\u6807\u9898", children: _jsx(Edit2, { size: 12, className: "text-slate-500" }) }), _jsx("button", { onClick: (e) => handleDelete(e, chat.id), className: "p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded", title: "\u5220\u9664\u5BF9\u8BDD", children: _jsx(Trash2, { size: 12, className: "text-red-500" }) })] }))] }) }, chat.id));
                })) }))] }));
}
/** 刷新聊天列表的方法导出（供外部调用） */
export function useChatListRefresh() {
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
    return { refreshKey, refresh };
}
