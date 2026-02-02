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

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[]; // ✅ 添加图片支持
}

export interface Conversation {
  id: string;
  roleId: string;
  title: string;
  lastMessage?: string;
  updatedAt: number;
}