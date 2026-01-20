export interface Role {
  id: string;
  name: string;
  persona: string;
  human: string;
  agentId?: string; // 关联的 Letta Agent ID
  createdAt: number;
}

export interface MemoryStore {
  roles: Record<string, Role>;
}
