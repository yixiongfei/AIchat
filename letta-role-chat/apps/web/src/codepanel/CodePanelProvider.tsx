
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

// ✅ 代码块类型定义
export type CodeArtifact = {
  id: string;
  title: string;
  language: string;
  code: string;
  timestamp: number;
};

type CodePanelState = {
  open: boolean;
  width: number;
  // ✅ 多代码块支持
  artifacts: CodeArtifact[];
  activeId: string | null;
  collapsedMap: Record<string, boolean>;
  // 保持向后兼容的单一代码块访问
  title: string;
  language: string;
  code: string;
};

type CodePanelAPI = CodePanelState & {
  openPanel: (payload: { title?: string; language?: string; code?: string }) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setWidth: (w: number) => void;
  // ✅ 新增多代码块管理
  addArtifact: (artifact: Omit<CodeArtifact, "id" | "timestamp">) => void;
  removeArtifact: (id: string) => void;
  setActiveArtifact: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  clearAllArtifacts: () => void;
};

const CodePanelContext = createContext<CodePanelAPI | null>(null);

const WIDTH_KEY = "artifactWidth";
const OPEN_KEY = "artifactPanelOpen";

// 生成唯一 ID
const generateId = () => `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function CodePanelProvider({ children }: { children: React.ReactNode }) {
  // ✅ 从 localStorage 读取打开/关闭状态，默认关闭
  const [open, setOpenState] = useState(() => {
    const saved = localStorage.getItem(OPEN_KEY);
    return saved === "true";
  });

  const [width, setWidthState] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 520;
  });

  // ✅ 多代码块状态
  const [artifacts, setArtifacts] = useState<CodeArtifact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // ✅ 持久化打开/关闭状态
  const setOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setOpenState((prev) => {
      const newValue = typeof value === "function" ? value(prev) : value;
      try {
        localStorage.setItem(OPEN_KEY, String(newValue));
      } catch {
        // ignore
      }
      return newValue;
    });
  }, []);

  const setWidth = useCallback((w: number) => {
    setWidthState(w);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {
      // ignore
    }
  }, []);

  // ✅ 添加代码块（自动展开新增的，折叠其他的）
  const addArtifact = useCallback((artifact: Omit<CodeArtifact, "id" | "timestamp">) => {
    const newId = generateId();
    const newArtifact: CodeArtifact = {
      ...artifact,
      id: newId,
      timestamp: Date.now(),
    };
    
    setArtifacts((prev) => [...prev, newArtifact]);
    setActiveId(newId);
    // 新代码块默认展开，其他折叠
    setCollapsedMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => (next[k] = true));
      next[newId] = false;
      return next;
    });
    setOpen(true);
  }, [setOpen]);

  // ✅ 删除代码块
  const removeArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    setCollapsedMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  // ✅ 设置当前活动代码块
  const setActiveArtifact = useCallback((id: string) => {
    setActiveId(id);
    // 展开选中的，折叠其他
    setCollapsedMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => (next[k] = true));
      next[id] = false;
      return next;
    });
  }, []);

  // ✅ 切换折叠状态
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // ✅ 清空所有代码块
  const clearAllArtifacts = useCallback(() => {
    setArtifacts([]);
    setActiveId(null);
    setCollapsedMap({});
  }, []);

  // ✅ 兼容旧 API：openPanel 现在会添加到列表
  const openPanel = useCallback((payload: { title?: string; language?: string; code?: string }) => {
    addArtifact({
      title: payload.title || "Code",
      language: payload.language || "text",
      code: payload.code || "",
    });
  }, [addArtifact]);

  const closePanel = useCallback(() => setOpen(false), [setOpen]);
  const togglePanel = useCallback(() => setOpen((v) => !v), [setOpen]);

  // ✅ 向后兼容：获取当前活动代码块的信息
  const activeArtifact = useMemo(
    () => artifacts.find((a) => a.id === activeId) || artifacts[artifacts.length - 1],
    [artifacts, activeId]
  );

  const value = useMemo<CodePanelAPI>(
    () => ({
      open,
      width,
      artifacts,
      activeId,
      collapsedMap,
      // 向后兼容
      title: activeArtifact?.title || "Code",
      language: activeArtifact?.language || "text",
      code: activeArtifact?.code || "",
      // 方法
      openPanel,
      closePanel,
      togglePanel,
      setWidth,
      addArtifact,
      removeArtifact,
      setActiveArtifact,
      toggleCollapsed,
      clearAllArtifacts,
    }),
    [
      open,
      width,
      artifacts,
      activeId,
      collapsedMap,
      activeArtifact,
      openPanel,
      closePanel,
      togglePanel,
      setWidth,
      addArtifact,
      removeArtifact,
      setActiveArtifact,
      toggleCollapsed,
      clearAllArtifacts,
    ]
  );

  return <CodePanelContext.Provider value={value}>{children}</CodePanelContext.Provider>;
}

export function useCodePanel() {
  const ctx = useContext(CodePanelContext);
  if (!ctx) throw new Error("useCodePanel must be used within CodePanelProvider");
  return ctx;
}
