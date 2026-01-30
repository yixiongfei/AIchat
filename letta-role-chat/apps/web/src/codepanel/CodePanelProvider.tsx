

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type CodePanelState = {
  open: boolean;
  title: string;
  language: string;
  code: string;
  width: number;
};

type CodePanelAPI = CodePanelState & {
  openPanel: (payload: { title?: string; language?: string; code?: string }) => void;
  closePanel: () => void;
  togglePanel: () => void;
  setWidth: (w: number) => void;
};

const CodePanelContext = createContext<CodePanelAPI | null>(null);

const WIDTH_KEY = "artifactWidth";

export function CodePanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Code");
  const [language, setLanguage] = useState("text");
  const [code, setCode] = useState("");

  const [width, setWidthState] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 520;
  });

  const setWidth = useCallback((w: number) => {
    setWidthState(w);
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch {
      // ignore
    }
  }, []);

  const openPanel = useCallback((payload: { title?: string; language?: string; code?: string }) => {
    if (payload.title) setTitle(payload.title);
    if (payload.language) setLanguage(payload.language);
    if (typeof payload.code === "string") setCode(payload.code);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo<CodePanelAPI>(
    () => ({ open, title, language, code, width, openPanel, closePanel, togglePanel, setWidth }),
    [open, title, language, code, width, openPanel, closePanel, togglePanel, setWidth]
  );

  return <CodePanelContext.Provider value={value}>{children}</CodePanelContext.Provider>;
}

export function useCodePanel() {
  const ctx = useContext(CodePanelContext);
  if (!ctx) throw new Error("useCodePanel must be used within CodePanelProvider");
  return ctx;
}
