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

export interface Conversation {
  id: string;
  roleId: string;
  title: string;
  lastMessage?: string;
  updatedAt: number;
}