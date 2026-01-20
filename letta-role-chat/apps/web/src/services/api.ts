const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://172.26.36.106:3001/api';

export const api = {
  async getRoles() {
    const res = await fetch(`${API_BASE_URL}/roles`);
    return res.json();
  },

  async createRole(role: { name: string; persona: string; human: string }) {
    const res = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    return res.json();
  },

  async syncRoles() {
    const res = await fetch(`${API_BASE_URL}/roles/sync`, {
      method: 'POST',
    });
    return res.json();
  },

  async getHistory(roleId: string) {
    const res = await fetch(`${API_BASE_URL}/roles/${roleId}/history`);
    return res.json();
  },

  // 流式消息发送
  async sendMessageStream(roleId: string, message: string, onChunk: (chunk: string) => void, onDone: () => void) {
    const response = await fetch(`${API_BASE_URL}/messages/${roleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        onDone();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') {
            onDone();
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            if (data.choices?.[0]?.delta?.content) {
              onChunk(data.choices[0].delta.content);
            } else if (data.content) {
              onChunk(data.content);
            }
          } catch (e) {
            // 忽略非 JSON 行
          }
        }
      }
    }
  }
};
