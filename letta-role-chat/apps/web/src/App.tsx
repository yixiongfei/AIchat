
import { useState, useEffect } from "react";
import { RoleList } from "./components/RoleList";
import { RoleEditor } from "./components/RoleEditor";
import { ChatWindow } from "./components/ChatWindow";
import { Role } from "./types";
import { api } from "./services/api";
import { RefreshCw, Moon, Sun } from "lucide-react";

function App() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorRole, setEditorRole] = useState<Role | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // 暗色模式：true=dark, false=light
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const shouldDark = saved ? saved === "dark" : prefersDark;

    setIsDark(shouldDark);
    document.documentElement.classList.toggle("dark", shouldDark);

    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const loadRoles = async () => {
    try {
      const data = await api.getRoles();
      setRoles(data);
      if (data.length > 0 && !selectedRole) {
        setSelectedRole(data[0]);
      }
    } catch (error) {
      console.error("Failed to load roles", error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await api.syncRoles();
      await loadRoles();
    } catch (error) {
      console.error("Sync failed", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateRole = async (roleData: {
    name: string;
    persona: string;
    human: string;
    voice?: string;
    speed?: number;
    pitch?: string;
    style?: string;
    avatarBase64?: string | null;
  }) => {
    try {
      // avatarBase64 may be null from the editor; normalize to undefined for API
      const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
      const newRole = await api.createRole(payload);
      setRoles((prev) => [newRole, ...prev]);
      setSelectedRole(newRole);

      // ✅ 保存成功后关闭编辑器
      setIsEditorOpen(false);
    } catch (error) {
      console.error("Failed to create role", error);
    }
  };

  const handleUpdateRole = async (roleId: string, roleData: {
    name?: string;
    persona?: string;
    human?: string;
    voice?: string;
    speed?: number;
    pitch?: string;
    style?: string;
    avatarBase64?: string | null;
  }) => {
    try {
      const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
      const updated = await api.updateRole(roleId, payload);
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRole(updated);
      setIsEditorOpen(false);
      setEditorRole(null);
    } catch (e) {
      console.error('Failed to update role', e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* 左侧栏 */}
      <div className="w-[18vw] shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        {/* 顶部栏 */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-bold text-xl text-blue-600 dark:text-blue-400">
            Letta Chat
          </h1>

          <div className="flex items-center gap-2">
            {/* 暗色切换按钮 */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              title={isDark ? "切换到亮色" : "切换到暗色"}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* 同步按钮 */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={[
                "p-2 rounded-full transition-colors",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                isSyncing
                  ? "animate-spin text-blue-400"
                  : "text-slate-600 dark:text-slate-300",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
              title="Sync from Letta Cloud"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        <RoleList
          roles={roles}
          selectedRoleId={selectedRole?.id}
          onSelectRole={setSelectedRole}
          onCreateClick={() => { setEditorRole(null); setIsEditorOpen(true); }}
          onEditRole={(r) => { setEditorRole(r); setIsEditorOpen(true); }}
        />
      </div>

      {/* 右侧 ChatWindow：占满右侧（全高） */}
      <aside className="w-[82vw] shrink-0 h-screen border-l border-slate-800/60 bg-slate-950 text-slate-100">
        {selectedRole ? (
          <ChatWindow
            role={selectedRole}
            showHeader={true}
            headerClassName="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur sticky top-0 z-10"
            bodyClassName="bg-gradient-to-b from-slate-950 to-slate-950"
            bodyInnerClassName="max-w-[1000px]"
            inputBarClassName="border-t border-slate-800/60 bg-slate-950/70 backdrop-blur"
            inputClassName="
              bg-slate-900/60 text-slate-100 ring-1 ring-slate-700/50
              placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/60
            "
            sendButtonClassName="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            userBubbleClassName="bg-blue-600 text-white"
            assistantBubbleClassName="bg-slate-900/70 text-slate-100 ring-1 ring-slate-800"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            请选择一个角色
          </div>
        )}
      </aside>

      {/* ✅ 关键：把 RoleEditor 真正渲染出来 */}
      {isEditorOpen && (
        <RoleEditor
          initialRole={editorRole ?? undefined}
          onSave={editorRole ? (data) => handleUpdateRole(editorRole.id, data) : handleCreateRole}
          onClose={() => { setIsEditorOpen(false); setEditorRole(null); }}
        />
      )}
    </div>
  );
}

export default App;