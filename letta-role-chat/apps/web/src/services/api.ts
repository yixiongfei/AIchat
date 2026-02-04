const API_BASE_URL = "/api";

import type { Chat, ChatsResponse, Message, MessagesResponse } from "../types";

/** 文本附件信息（发送时携带完整内容） */
export interface AttachmentInfo {
  fileName: string;
  content: string;       // 文本内容
  charCount: number;
  lineCount: number;
}

/** 推理步骤信息 */
export interface ReasoningStep {
  content: string;
  source?: string;
  timestamp: number;
}

/** 流式消息回调 */
export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onReasoning?: (step: ReasoningStep) => void;
  onThinking?: (tool: string) => void;
}

export const api = {
  async getRoles() {
    const res = await fetch(`${API_BASE_URL}/roles`);
    const data = await res.json();
    return data.map((r: any) => ({
      ...r,
      avatar: r.avatar ? `${API_BASE_URL}/avatars/${r.avatar}` : undefined
    }));
  },

  async createRole(role: { 
    name: string; 
    persona: string; 
    human: string;
    voice?: string;
    speed?: number;
    pitch?: string;
    style?: string;
    avatarBase64?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    return res.json();
  },

  async updateRole(roleId: string, role: { 
    name?: string; 
    persona?: string; 
    human?: string;
    voice?: string;
    speed?: number;
    pitch?: string;
    style?: string;
    avatarBase64?: string | undefined;
  }) {
    const res = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    return res.json();
  },

  async syncRoles() {
    const res = await fetch(`${API_BASE_URL}/roles/sync`, { method: 'POST' });
    return res.json();
  },

  async getHistory(roleId: string) {
    const res = await fetch(`${API_BASE_URL}/roles/${roleId}/history`);
    return res.json();
  },

  async deleteHistory(roleId: string) {
    const res = await fetch(`${API_BASE_URL}/messages/${roleId}`, { method: 'DELETE' });
    return res.json();
  },

  async deleteAudio(fileName: string) {
    await fetch(`${API_BASE_URL}/tts/audio/${fileName}`, { method: 'DELETE' });
  },

  // ========================================
  // Chat API（新增）
  // ========================================
  
  /** 获取指定 agent 的所有聊天 */
  async getChats(agentId: string, search?: string): Promise<ChatsResponse> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const url = `${API_BASE_URL}/chats/${agentId}${params.toString() ? '?' + params : ''}`;
    const res = await fetch(url);
    return res.json();
  },

  /** 创建新聊天 */
  async createChat(agentId: string, title?: string): Promise<Chat> {
    const res = await fetch(`${API_BASE_URL}/chats/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  /** 更新聊天标题 */
  async updateChat(chatId: string, title: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  /** 删除聊天 */
  async deleteChat(chatId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  /** 获取聊天的消息 */
  async getChatMessages(chatId: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE_URL}/chats/${chatId}/messages`);
    const data: MessagesResponse = await res.json();
    return data.messages;
  },

  // ✅ 流式消息发送（支持图片、文本附件、推理过程和 chatId）
  async sendMessageStream(
    roleId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    images?: string[],
    attachments?: AttachmentInfo[],
    onReasoning?: (step: ReasoningStep) => void,
    onThinking?: (tool: string) => void,
    chatId?: string
  ) {
    const response = await fetch(`${API_BASE_URL}/messages/${roleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, images, attachments, chatId }),
    });

    if (!response.body) {
      onDone();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return false;
      const dataStr = line.slice(6).trim();
      if (dataStr === '[DONE]') return true;
      try {
        const data = JSON.parse(dataStr);
        
        // 处理推理消息
        if (data.type === 'reasoning' && onReasoning) {
          onReasoning({
            content: data.content,
            source: data.source,
            timestamp: Date.now()
          });
          return false;
        }
        
        // 处理思考/工具调用消息
        if (data.type === 'thinking' && onThinking) {
          onThinking(data.tool || 'unknown');
          return false;
        }
        
        // 处理普通内容
        const content = data.choices?.[0]?.delta?.content ?? data.content;
        if (content) onChunk(content);
      } catch {
        // 忽略非 JSON 行
      }
      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // 处理残留 buffer
        for (const line of buffer.split('\n')) {
          if (line && processLine(line)) return onDone();
        }
        return onDone();
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (processLine(line)) return onDone();
      }
    }
  }
};
