
import { useCallback, useEffect, useState } from "react";
import { Role } from "../types";
import { api } from "../services/api";

export default function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadRoles = useCallback(async () => {
    try {
      const data = await api.getRoles();
      setRoles(data);
      setSelectedRole((prev) => prev ?? data[0] ?? null);
    } catch (error) {
      console.error("Failed to load roles", error);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const syncRoles = useCallback(async () => {
    setIsSyncing(true);
    try {
      await api.syncRoles();
      await loadRoles();
    } catch (error) {
      console.error("Sync failed", error);
    } finally {
      setIsSyncing(false);
    }
  }, [loadRoles]);

  const createRole = useCallback(async (roleData: any) => {
    const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
    const newRole = await api.createRole(payload);
    setRoles((prev) => [newRole, ...prev]);
    setSelectedRole(newRole);
    return newRole;
  }, []);

  const updateRole = useCallback(async (roleId: string, roleData: any) => {
    const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
    const updated = await api.updateRole(roleId, payload);
    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedRole(updated);
    return updated;
  }, []);

  return {
    roles,
    selectedRole,
    setSelectedRole,
    isSyncing,
    loadRoles,
    syncRoles,
    createRole,
    updateRole,
  };
}
