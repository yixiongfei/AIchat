export interface Role {
  id: string;
  name: string;
  persona: string;
  human: string;
  agentId?: string;
  createdAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  roleId: string;
  title: string;
  lastMessage?: string;
  updatedAt: number;
}
