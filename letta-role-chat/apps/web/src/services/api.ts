const API_BASE_URL = "/api";

export const api = {
  async getRoles() {
    const res = await fetch(`${API_BASE_URL}/roles`);
    const data = await res.json();
    // 将 avatar 文件名转换为完整 URL
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
    const res = await fetch(`${API_BASE_URL}/roles/sync`, {
      method: 'POST',
    });
    return res.json();
  },

  async getHistory(roleId: string) {
    const res = await fetch(`${API_BASE_URL}/roles/${roleId}/history`);
    return res.json();
  },

  async deleteHistory(roleId: string) {
    const res = await fetch(`${API_BASE_URL}/messages/${roleId}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  // 删除音频文件
  async deleteAudio(fileName: string) {
    await fetch(`${API_BASE_URL}/tts/audio/${fileName}`, {
      method: 'DELETE',
    });
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

    // Use a persistent buffer to handle cases where a single 'data: {...}' line
    // is split across multiple stream chunks. We append each decoded chunk
    // to the buffer, split by newline, process full lines, and keep the last
    // partial line for the next read.
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // process any remaining buffered data
        if (buffer) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (!line) continue;
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
                // ignore non-JSON lines
              }
            }
          }
        }
        onDone();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      // keep last line (may be partial)
      buffer = lines.pop() || '';

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
