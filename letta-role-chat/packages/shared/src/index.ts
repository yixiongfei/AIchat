// ========================================
// 共享类型定义 - 前后端统一使用
// ========================================

/** 角色（Agent） */
export interface Role {
  id: string;
  name: string;
  persona: string;
  human: string;
  agentId?: string;
  avatar?: string;
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
  createdAt: number;
}

/** 消息附件信息（用于显示，不含内容） */
export interface MessageAttachment {
  fileName: string;
  charCount: number;
  lineCount: number;
}

/** 聊天消息 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[];
  attachments?: MessageAttachment[];
}

/** 聊天会话 */
export interface Chat {
  id: string;
  agent_id: string;
  letta_conversation_id?: string;
  title: string;
  created_at: number;
  updated_at: number;
  last_message?: string;
  message_count?: number;
}

/** 聊天列表响应 */
export interface ChatsResponse {
  chats: Chat[];
  total: number;
}

/** 聊天消息响应 */
export interface MessagesResponse {
  messages: Message[];
}

// ========================================
// 数据库行类型（后端用）
// ========================================

/** agents 表行 */
export interface AgentRow {
  id: string;
  name: string;
  persona: string;
  human: string;
  agent_id: string;
  avatar: string | null;
  voice: string;
  speed: number;
  pitch: string;
  style: string;
  created_at: number;
}

/** messages 表行 */
export interface MessageRow {
  id: string;
  agent_id: string;
  chat_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images: string | null;
}

/** chats 表行 */
export interface ChatRow {
  id: string;
  agent_id: string;
  letta_conversation_id: string | null;
  title: string;
  created_at: number;
  updated_at: number;
}

// ========================================
// API 通用响应类型
// ========================================

/** 删除操作响应 */
export interface DeleteResult {
  success: boolean;
  deleted: number;
}

/** 同步操作响应 */
export interface SyncResult {
  success: boolean;
  count: number;
  pruned: boolean;
  deletedCount: number;
}
