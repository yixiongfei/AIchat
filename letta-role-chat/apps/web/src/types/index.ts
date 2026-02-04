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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[];                  // 图片支持（base64）
  attachments?: MessageAttachment[];  // 文本附件支持
}

/** 聊天会话 */
export interface Chat {
  id: string;
  agent_id: string;
  letta_conversation_id?: string;  // Letta 平台的 conversation ID
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