// src/components/ChatList.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { api } from "../services/api";
import type { Chat } from "../types";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

interface ChatListProps {
  agentId: string;
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
  isCollapsed?: boolean;
}

/** 格式化时间显示 */
function formatTime(timestamp: number): string {
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
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return "刚刚";
}

/** 截断文本 */
function truncate(text: string, maxLen: number): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

export default function ChatList({
  agentId,
  selectedChatId,
  onSelectChat,
  onNewChat,
  isCollapsed = false,
}: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // 获取聊天列表
  const fetchChats = useCallback(async () => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const data = await api.getChats(agentId, searchQuery || undefined);
      // 防御性处理：确保 chats 始终为数组
      setChats(Array.isArray(data?.chats) ? data.chats : []);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      setChats([]); // 出错时重置为空数组
    } finally {
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
    if (debouncedSearch !== searchQuery) return;
    fetchChats();
  }, [debouncedSearch]);

  // 删除聊天
  const handleDelete = useCallback(
    async (e: React.MouseEvent, chatId: string) => {
      e.stopPropagation();
      if (!confirm("确定要删除这个对话吗？")) return;

      try {
        await api.deleteChat(chatId);
        setChats((prev) => prev.filter((c) => c.id !== chatId));
      } catch (error) {
        console.error("Failed to delete chat:", error);
      }
    },
    []
  );

  // 开始编辑标题
  const startEdit = useCallback((e: React.MouseEvent, chat: Chat) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  }, []);

  // 保存标题
  const saveTitle = useCallback(
    async (chatId: string) => {
      if (!editTitle.trim()) {
        setEditingId(null);
        return;
      }

      try {
        await api.updateChat(chatId, editTitle.trim());
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId ? { ...c, title: editTitle.trim() } : c
          )
        );
      } catch (error) {
        console.error("Failed to update chat title:", error);
      } finally {
        setEditingId(null);
      }
    },
    [editTitle]
  );

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle("");
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, chatId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveTitle(chatId);
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [saveTitle, cancelEdit]
  );

  // 折叠模式下显示对话图标列表（类似 Agent 列表）
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 border-t border-slate-200 dark:border-slate-800">
        {/* 分隔线标识 */}
        <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full mb-2" />
        
        {/* 对话图标列表 */}
        <div className="flex flex-col items-center gap-1 w-full overflow-y-auto max-h-[40vh] scrollbar-hide">
          {isLoading ? (
            <div className="py-2">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : chats.length === 0 ? (
            <div className="py-2">
              <MessageSquare size={20} className="text-slate-400" />
            </div>
          ) : (
            chats.map((chat, index) => {
              const isActive = selectedChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    "w-full py-2 flex justify-center transition-colors rounded-xl mx-1",
                    "hover:bg-slate-100 dark:hover:bg-slate-800/60",
                    isActive && "bg-slate-200 dark:bg-slate-800"
                  )}
                  title={chat.title}
                >
                  <div className="relative">
                    <MessageSquare 
                      size={22} 
                      className={cn(
                        isActive 
                          ? "text-blue-500 dark:text-blue-400" 
                          : "text-slate-400 dark:text-slate-500"
                      )} 
                    />
                    {/* 序号标识 */}
                    <span className={cn(
                      "absolute -bottom-1 -right-1 text-[9px] font-medium w-3.5 h-3.5 flex items-center justify-center rounded-full",
                      isActive 
                        ? "bg-blue-500 text-white" 
                        : "bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300"
                    )}>
                      {index + 1}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-2 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 flex-1 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-md px-2 py-1 transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <h3 className="font-semibold text-slate-700 dark:text-slate-200">对话</h3>
            {chats.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {chats.length}
              </span>
            )}
          </button>
          <button
            onClick={onNewChat}
            className="p-2 rounded-lg transition-colors bg-green-500/10 hover:bg-green-500/20 active:scale-[0.98] dark:bg-green-500/10 dark:hover:bg-green-500/20"
            title="新建对话"
          >
            <Plus size={18} className="text-green-600 dark:text-green-400" />
          </button>
        </div>
      </div>

      {/* Chat List */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : chats.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {searchQuery ? "没有找到匹配的对话" : "暂无对话，点击 + 新建"}
            </div>
          ) : (
            chats.map((chat) => {
              const isActive = selectedChatId === chat.id;
              const isEditing = editingId === chat.id;

              return (
                <div
                  key={chat.id}
                  onClick={() => !isEditing && onSelectChat(chat)}
                  className={cn(
                    "group mx-2 mb-1 px-3 py-2 rounded-xl cursor-pointer transition-colors",
                    "hover:bg-slate-100 dark:hover:bg-slate-800/60",
                    isActive && "bg-slate-200 dark:bg-slate-800"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare
                      size={16}
                      className={cn(
                        "shrink-0 mt-0.5",
                        isActive
                          ? "text-blue-500"
                          : "text-slate-400 dark:text-slate-500"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, chat.id)}
                            onBlur={() => saveTitle(chat.id)}
                            placeholder="输入对话标题"
                            title="对话标题"
                            className="flex-1 px-1.5 py-0.5 text-sm rounded
                              bg-white dark:bg-slate-700
                              border border-slate-300 dark:border-slate-600
                              focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveTitle(chat.id);
                            }}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                            title="保存标题"
                            aria-label="保存标题"
                          >
                            <Check size={14} className="text-green-600" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelEdit();
                            }}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title="取消编辑"
                            aria-label="取消编辑"
                          >
                            <X size={14} className="text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-sm truncate text-slate-800 dark:text-slate-200">
                            {chat.title}
                          </p>
                          {chat.last_message && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {truncate(chat.last_message, 40)}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            {formatTime(chat.updated_at)}
                            {chat.message_count !== undefined && (
                              <span className="ml-2">{chat.message_count} 条消息</span>
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    {!isEditing && (
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startEdit(e, chat)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                          title="编辑标题"
                        >
                          <Edit2 size={12} className="text-slate-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, chat.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="删除对话"
                        >
                          <Trash2 size={12} className="text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** 刷新聊天列表的方法导出（供外部调用） */
export function useChatListRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { refreshKey, refresh };
}
