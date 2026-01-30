
import { useState, useEffect, useRef } from "react";
import { RoleList } from "./components/RoleList";
import { RoleEditor } from "./components/RoleEditor";
import { ChatWindow } from "./components/ChatWindow";
import { Role } from "./types";
import { api } from "./services/api";
import { RefreshCw, Moon, Sun, Menu, X, Code2 } from "lucide-react";

// ✅ 新增：代码侧边面板组件
import { CodeSidePanel } from "./components/CodeSidePanel";

type ArtifactPayload = {
  title?: string;
  language?: string;
  code?: string;
};

function App() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorRole, setEditorRole] = useState<Role | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // 暗色模式：true=dark, false=light
  const [isDark, setIsDark] = useState(false);

  // ✅ 移动端侧边栏控制
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ✅ 侧边栏宽度控制（仅桌面端）
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("sidebarWidth");
    return saved ? parseInt(saved, 10) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const minWidth = 200;
  const maxWidth = 600;

  // ✅ ChatWindow ref - 用于移动端调用内部方法
  const chatWindowRef = useRef<any>(null);

  // ✅ 移动端自动朗读状态（状态提升）
  const [autoSpeak, setAutoSpeak] = useState(false);

  // =========================
  // ✅ 新增：Claude 风格“右侧代码面板（Artifacts）”状态
  // =========================
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactTitle, setArtifactTitle] = useState("code");
  const [artifactLang, setArtifactLang] = useState("text");
  const [artifactCode, setArtifactCode] = useState("");
  // ✅ 右侧代码面板宽度（桌面端）
  const [artifactWidth, setArtifactWidth] = useState(() => {
    const saved = localStorage.getItem("artifactWidth");
    return saved ? parseInt(saved, 10) : 520;
  });

  useEffect(() => {
    localStorage.setItem("artifactWidth", String(artifactWidth));
  }, [artifactWidth]);


  // ✅ 通过全局事件打开（不需要改 ChatWindow/RoleList）
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<ArtifactPayload>;
      const detail = ce.detail || {};
      if (detail.title) setArtifactTitle(detail.title);
      if (detail.language) setArtifactLang(detail.language);
      if (typeof detail.code === "string") setArtifactCode(detail.code);
      setArtifactOpen(true);
    };
    window.addEventListener("open-artifact", handler as EventListener);
    return () => window.removeEventListener("open-artifact", handler as EventListener);
  }, []);

  // ✅ 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // ✅ 动态加载 Live2D（仅桌面端）
  useEffect(() => {
    if (isMobile) {
      // 移动端：移除 Live2D 相关元素
      const script = document.getElementById("live2d-autoload");
      if (script) {
        script.remove();
      }

      // 移除所有 Live2D 相关元素
      const widget = document.getElementById("live2d-widget");
      if (widget) {
        widget.remove();
      }

      // Live2D 可能创建的其他元素
      const tips = document.getElementById("live2d-tips");
      if (tips) {
        tips.remove();
      }

      // 添加 CSS 隐藏（双重保障）
      const style = document.createElement("style");
      style.id = "live2d-mobile-hide";
      style.textContent = `
        #live2d-widget,
        #live2d-tips,
        canvas[id^="live2d"] {
          display: none !important;
        }
      `;
      document.head.appendChild(style);

      return;
    }

    // 桌面端：移除隐藏样式
    const hideStyle = document.getElementById("live2d-mobile-hide");
    if (hideStyle) {
      hideStyle.remove();
    }

    // 检查脚本是否已存在，避免重复加载（支持静态 <script> 或 动态注入）
    const alreadyInjected =
      Boolean(document.getElementById("live2d-autoload")) ||
      Array.from(document.scripts).some((s) => (s.src || "").includes("live2d-widget")) ||
      // 某些版本会声明全局变量
      (window as any).live2d_path !== undefined;
    if (alreadyInjected) return;

    // 加载 Live2D
    const script = document.createElement("script");
    script.id = "live2d-autoload";
    script.src = "https://cdn.jsdelivr.net/gh/yixiongfei/live2d-widget@master/dist/autoload.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // 切换到移动端时清理
      const existing = document.getElementById("live2d-autoload");
      if (existing) {
        existing.remove();
      }

      const widget = document.getElementById("live2d-widget");
      if (widget) {
        widget.remove();
      }
    };
  }, [isMobile]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const shouldDark = saved ? saved === "dark" : prefersDark;

    setIsDark(shouldDark);
    document.documentElement.classList.toggle("dark", shouldDark);

    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 处理侧边栏拖动调整（仅桌面端显示）
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
        localStorage.setItem("sidebarWidth", newWidth.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, isMobile]);

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
      const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
      const newRole = await api.createRole(payload);
      setRoles((prev) => [newRole, ...prev]);
      setSelectedRole(newRole);
      setIsEditorOpen(false);
    } catch (error) {
      console.error("Failed to create role", error);
    }
  };

  const handleUpdateRole = async (
    roleId: string,
    roleData: {
      name?: string;
      persona?: string;
      human?: string;
      voice?: string;
      speed?: number;
      pitch?: string;
      style?: string;
      avatarBase64?: string | null;
    }
  ) => {
    try {
      const payload = { ...roleData, avatarBase64: roleData.avatarBase64 ?? undefined };
      const updated = await api.updateRole(roleId, payload);
      setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setSelectedRole(updated);
      setIsEditorOpen(false);
      setEditorRole(null);
    } catch (e) {
      console.error("Failed to update role", e);
    }
  };

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* ✅ 移动端遮罩层 */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ✅ 左侧栏 - 响应式 */}
      <div
        className={`
          shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 
          dark:border-slate-800 dark:bg-slate-900/40
          transition-transform duration-300 ease-in-out
          ${isMobile ? "fixed inset-y-0 left-0 w-[280px] z-50" : "relative z-0"}
          ${isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"}
        `}
        style={!isMobile ? { width: `${sidebarWidth}px` } : undefined}
      >
        {/* 顶部栏 */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white dark:border-slate-800 dark:bg-slate-900">
          <h1 className="font-bold text-xl text-blue-600 dark:text-blue-400">Letta Chat</h1>

          <div className="flex items-center gap-2">
            {/* ✅ 移动端关闭按钮 */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300 md:hidden"
                title="关闭侧边栏"
              >
                <X size={20} />
              </button>
            )}

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
                isSyncing ? "animate-spin text-blue-400" : "text-slate-600 dark:text-slate-300",
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
          onSelectRole={handleSelectRole}
          onCreateClick={() => {
            setEditorRole(null);
            setIsEditorOpen(true);
          }}
          onEditRole={(r) => {
            setEditorRole(r);
            setIsEditorOpen(true);
          }}
        />
      </div>

      {/* ✅ 拖动分隔条（仅桌面端显示） */}
      {!isMobile && (
        <div
          className="group relative w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-blue-500/20 transition-colors dark:hover:bg-blue-500/30 z-0"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute inset-y-0 left-0 w-px bg-slate-300 group-hover:bg-blue-500 transition-colors dark:bg-slate-700 dark:group-hover:bg-blue-400" />
        </div>
      )}

      {/* 右侧 ChatWindow：占满剩余空间 */}
      <aside className="flex-1 min-w-0 h-screen border-l border-slate-800/60 bg-slate-950 text-slate-100 relative flex flex-col"
      style={{
        // ✅ 仅桌面端且面板打开时，右侧留出空间避免遮挡
        marginRight: !isMobile && artifactOpen ? `${artifactWidth}px` : undefined,
      }}
      >
        {/* ✅ 移动端顶部栏：显示汉堡菜单 + Agent 信息 + 功能按钮 */}
        {isMobile && selectedRole && (
          <div className="shrink-0 px-3 py-2 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur sticky top-0 z-30 md:hidden">
            <div className="flex items-center gap-2">
              {/* 汉堡菜单按钮 */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-800/60 text-white transition-colors shrink-0"
                title="打开侧边栏"
              >
                <Menu size={18} />
              </button>

              {/* Agent 头像和名称 */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {selectedRole.avatar ? (
                  <img
                    src={selectedRole.avatar}
                    alt={selectedRole.name}
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-slate-700 shrink-0"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {selectedRole.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate">{selectedRole.name}</div>
                </div>
              </div>

              {/* 功能按钮组 - 使用 emoji 图标节省空间 */}
              <div className="flex items-center gap-0.5 shrink-0">
                {/* 自动朗读开关 - 显示开启/关闭状态 */}
                <button
                  onClick={() => chatWindowRef.current?.toggleAutoSpeak?.()}
                  className={`p-1.5 rounded-md text-base transition-all ${
                    autoSpeak ? "bg-blue-600/80 hover:bg-blue-600" : "bg-slate-800/40 hover:bg-slate-800/60"
                  }`}
                  title={autoSpeak ? "自动朗读：开" : "自动朗读：关"}
                >
                  {autoSpeak ? "🔊" : "🔇"}
                </button>

                {/* 停止按钮 */}
                <button
                  onClick={() => chatWindowRef.current?.stopSpeak?.()}
                  className="p-1.5 rounded-md text-base bg-slate-800/40 hover:bg-slate-800/60 transition-all"
                  title="停止"
                >
                  ⏹
                </button>

                {/* 清空历史 */}
                <button
                  onClick={() => chatWindowRef.current?.clearHistory?.()}
                  className="p-1.5 rounded-md text-base bg-slate-800/40 hover:bg-slate-800/60 transition-all"
                  title="清空历史"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 聊天窗口 */}
        <div className="flex-1 min-h-0">
          {selectedRole ? (
            <ChatWindow
              ref={chatWindowRef}
              role={selectedRole}
              showHeader={!isMobile}
              defaultAutoSpeak={autoSpeak}
              onAutoSpeakChange={setAutoSpeak}
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
            <div className="h-full flex items-center justify-center text-slate-400">请选择一个角色</div>
          )}
        </div>
      </aside>

      {/* RoleEditor */}
      {isEditorOpen && (
        <RoleEditor
          initialRole={editorRole ?? undefined}
          onSave={editorRole ? (data) => handleUpdateRole(editorRole.id, data) : handleCreateRole}
          onClose={() => {
            setIsEditorOpen(false);
            setEditorRole(null);
          }}
        />
      )}

      {/* =========================
          ✅ 新增：Claude 风格“侧边代码面板”
          - 不改变你原结构，只是额外渲染在最外层
         ========================= */}
      <CodeSidePanel
      open={artifactOpen}
      onClose={() => setArtifactOpen(false)}
      title={artifactTitle}
      language={artifactLang}
      code={artifactCode}
      width={artifactWidth}
      onWidthChange={setArtifactWidth}
      minWidth={360}
      maxWidth={980}
      />

      {/* ✅ 新增：右下角浮动按钮（不影响现有 UI）
          点击可打开/关闭面板
      */}
      <button
        onClick={() => setArtifactOpen((v) => !v)}
        className={[
          "fixed bottom-4 right-4 z-[60]",
          "rounded-full p-3",
          "bg-blue-600 hover:bg-blue-700",
          "text-white shadow-lg shadow-black/30",
          "transition-transform active:scale-95",
        ].join(" ")}
        title="Open Code Panel"
      >
        <Code2 size={20} />
      </button>
    </div>
  );
}

export default App;
