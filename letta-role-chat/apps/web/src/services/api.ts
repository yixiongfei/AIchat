const API_BASE_URL = "/api";

/** 文本附件信息（发送时携带完整内容） */
export interface AttachmentInfo {
  fileName: string;
  content: string;       // 文本内容
  charCount: number;
  lineCount: number;
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

  // ✅ 流式消息发送（支持图片和文本附件）
  async sendMessageStream(
    roleId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    images?: string[],
    attachments?: AttachmentInfo[]
  ) {
    const response = await fetch(`${API_BASE_URL}/messages/${roleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, images, attachments }),
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
