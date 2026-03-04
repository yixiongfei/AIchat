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

// ✅ 自定义 API 错误类，携带状态码和服务端错误信息
export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// ✅ 统一请求封装：自动检查响应状态并解析 JSON
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    // 尝试解析服务端返回的错误信息
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body.error || body.message || JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(res.status, `请求失败 (${res.status}): ${detail}`, detail);
  }

  return res.json();
}

export const api = {
  async getRoles() {
    const data = await request<any[]>(`${API_BASE_URL}/roles`);
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
    return request(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
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
    return request(`${API_BASE_URL}/roles/${roleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
  },

  async syncRoles() {
    return request(`${API_BASE_URL}/roles/sync`, { method: 'POST' });
  },

  async getHistory(roleId: string) {
    return request(`${API_BASE_URL}/roles/${roleId}/history`);
  },

  async deleteHistory(roleId: string) {
    return request(`${API_BASE_URL}/messages/${roleId}`, { method: 'DELETE' });
  },

  async deleteMessage(messageId: string) {
    return request(`${API_BASE_URL}/messages/message/${messageId}`, { method: 'DELETE' });
  },

  async deleteAudio(fileName: string) {
    const res = await fetch(`${API_BASE_URL}/tts/audio/${fileName}`, { method: 'DELETE' });
    if (!res.ok) {
      console.error(`删除音频失败: ${res.status}`);
    }
  },

  // ========================================
  // Chat API
  // ========================================
  
  /** 获取指定 agent 的所有聊天 */
  async getChats(agentId: string, search?: string): Promise<ChatsResponse> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const url = `${API_BASE_URL}/chats/${agentId}${params.toString() ? '?' + params : ''}`;
    return request<ChatsResponse>(url);
  },

  /** 创建新聊天 */
  async createChat(agentId: string, title?: string): Promise<Chat> {
    return request<Chat>(`${API_BASE_URL}/chats/${agentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  },

  /** 更新聊天标题 */
  async updateChat(chatId: string, title: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
  },

  /** 删除聊天 */
  async deleteChat(chatId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`${API_BASE_URL}/chats/${chatId}`, {
      method: 'DELETE',
    });
  },

  /** 清空聊天的消息（保留聊天本身） */
  async clearChatMessages(chatId: string): Promise<{ success: boolean; deleted: number }> {
    return request<{ success: boolean; deleted: number }>(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'DELETE',
    });
  },

  /** 获取聊天的消息 */
  async getChatMessages(chatId: string): Promise<Message[]> {
    const data = await request<MessagesResponse>(`${API_BASE_URL}/chats/${chatId}/messages`);
    return data.messages;
  },

  // ✅ 流式消息发送（支持图片、文本附件、推理过程和 chatId）
  async sendMessageStream(params: {
    roleId: string;
    message: string;
    onChunk: (chunk: string) => void;
    onDone: () => void;
    images?: string[];
    attachments?: AttachmentInfo[];
    onReasoning?: (step: ReasoningStep) => void;
    onThinking?: (tool: string) => void;
    chatId?: string;
  }) {
    const { roleId, message, onChunk, onDone, images, attachments, onReasoning, onThinking, chatId } = params;

    const response = await fetch(`${API_BASE_URL}/messages/${roleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, images, attachments, chatId }),
    });

    // ✅ 流式请求也需检查 HTTP 状态
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        detail = body.error || body.message || detail;
      } catch { /* ignore */ }
      throw new ApiError(response.status, `发送消息失败 (${response.status}): ${detail}`, detail);
    }

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
