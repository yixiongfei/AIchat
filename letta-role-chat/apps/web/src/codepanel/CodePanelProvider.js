import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
const CodePanelContext = createContext(null);
const WIDTH_KEY = "artifactWidth";
const OPEN_KEY = "artifactPanelOpen";
// 生成唯一 ID
const LANGUAGE_EXTENSION_MAP = {
    typescript: "ts",
    ts: "ts",
    javascript: "js",
    js: "js",
    jsx: "jsx",
    tsx: "tsx",
    python: "py",
    py: "py",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    cs: "cs",
    go: "go",
    rust: "rs",
    ruby: "rb",
    php: "php",
    swift: "swift",
    kotlin: "kt",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    json: "json",
    yaml: "yml",
    yml: "yml",
    xml: "xml",
    graphql: "graphql",
    markdown: "md",
    md: "md",
    txt: "txt",
    text: "txt",
};
const shortHash = (input) => {
    let hash = 0;
    if (input.length === 0)
        return "000000";
    for (let i = 0; i < input.length; i += 1) {
        const chr = input.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 6).padStart(6, "0");
};
const inferExtension = (language) => LANGUAGE_EXTENSION_MAP[language] || language || "txt";
const buildStableId = (language, code) => `artifact-${inferExtension(language)}-${shortHash(`${language}::${code}`)}`;
/**
 * 从代码内容中提取 title/文件名，并返回提取的 title 和移除 title 行后的代码
 * 支持多种格式：
 * - (title: filename.py)
 * - # title: filename.py
 * - // title: filename.py
 * - 块注释格式
 *
 * @returns { title: string | null, cleanedCode: string }
 */
const extractTitleFromContent = (code) => {
    // 只检查代码的前 500 个字符（title 通常在开头）
    const header = code.slice(0, 500);
    // 按优先级尝试多种模式
    const patterns = [
        // (title: filename.ext) - 带括号格式
        /\(\s*title\s*:\s*([^)\n]+?)\s*\)/i,
        // # title: filename.ext 或 // title: filename.ext 或 -- title: filename.ext
        /(?:^|[\n\r])[ \t]*(?:#|\/\/|--|;)\s*title\s*:\s*([^\n\r]+)/i,
        // /* title: filename.ext */ 或 /** title: filename.ext */
        /\/\*+\s*title\s*:\s*([^*\n]+?)\s*\*+\//i,
        // title: filename.ext（独立行）
        /(?:^|[\n\r])[ \t]*title\s*:\s*([^\n\r]+)/i,
        // filename: xxx.ext 或 File: xxx.ext
        /(?:^|[\n\r])[ \t]*(?:filename|file)\s*:\s*([^\n\r]+)/i,
    ];
    for (const pattern of patterns) {
        const match = pattern.exec(header);
        if (match?.[1]) {
            const extracted = match[1].trim();
            // 清理可能的尾部注释符号
            const cleaned = extracted.replace(/\s*(?:\*\/|-->|#|\/\/)?\s*$/, "").trim();
            if (cleaned.length > 0 && cleaned.length < 100) {
                // 移除匹配到的 title 行
                const cleanedCode = code.replace(match[0], "").replace(/^\n+/, "");
                return { title: cleaned, cleanedCode };
            }
        }
    }
    return { title: null, cleanedCode: code };
};
export function CodePanelProvider({ children }) {
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
    const [artifacts, setArtifacts] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [collapsedMap, setCollapsedMap] = useState({});
    // ✅ 持久化打开/关闭状态
    const setOpen = useCallback((value) => {
        setOpenState((prev) => {
            const newValue = typeof value === "function" ? value(prev) : value;
            try {
                localStorage.setItem(OPEN_KEY, String(newValue));
            }
            catch {
                // ignore
            }
            return newValue;
        });
    }, []);
    const setWidth = useCallback((w) => {
        setWidthState(w);
        try {
            localStorage.setItem(WIDTH_KEY, String(w));
        }
        catch {
            // ignore
        }
    }, []);
    // ✅ 添加代码块（自动展开新增的，折叠其他的）
    const addArtifact = useCallback((artifact) => {
        const language = (artifact.language || "text").toLowerCase();
        const code = artifact.code || "";
        const stableId = artifact.id || buildStableId(language, code);
        const agentName = artifact.agentName || "Agent";
        setArtifacts((prev) => {
            if (prev.some((a) => a.id === stableId)) {
                setActiveId(stableId);
                setCollapsedMap((map) => {
                    const next = { ...map };
                    Object.keys(next).forEach((k) => (next[k] = true));
                    next[stableId] = false;
                    return next;
                });
                setOpen(true);
                return prev;
            }
            // 优先从代码内容中提取 title: xxx 格式的文件名，并清理 title 行
            const { title: extracted, cleanedCode } = extractTitleFromContent(code);
            // 如果没有提取到，使用默认的 agentName-code-N 格式
            const defaultName = `${agentName}-code-${prev.length + 1}`;
            const title = extracted || defaultName;
            const newArtifact = {
                id: stableId,
                title,
                language,
                code: cleanedCode, // 使用清理后的代码
                timestamp: Date.now(),
            };
            setActiveId(stableId);
            setCollapsedMap((map) => {
                const next = { ...map };
                Object.keys(next).forEach((k) => (next[k] = true));
                next[stableId] = false;
                return next;
            });
            setOpen(true);
            return [...prev, newArtifact];
        });
    }, [setOpen]);
    // ✅ 删除代码块
    const removeArtifact = useCallback((id) => {
        setArtifacts((prev) => prev.filter((a) => a.id !== id));
        setCollapsedMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setActiveId((prev) => (prev === id ? null : prev));
    }, []);
    // ✅ 设置当前活动代码块
    const setActiveArtifact = useCallback((id) => {
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
    const toggleCollapsed = useCallback((id) => {
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
    const openPanel = useCallback((payload) => {
        addArtifact({
            title: payload.title,
            language: payload.language,
            code: payload.code || "",
            agentName: payload.agentName,
        });
    }, [addArtifact]);
    const closePanel = useCallback(() => setOpen(false), [setOpen]);
    const togglePanel = useCallback(() => setOpen((v) => !v), [setOpen]);
    // ✅ 向后兼容：获取当前活动代码块的信息
    const activeArtifact = useMemo(() => artifacts.find((a) => a.id === activeId) || artifacts[artifacts.length - 1], [artifacts, activeId]);
    const value = useMemo(() => ({
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
    }), [
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
    ]);
    return _jsx(CodePanelContext.Provider, { value: value, children: children });
}
export function useCodePanel() {
    const ctx = useContext(CodePanelContext);
    if (!ctx)
        throw new Error("useCodePanel must be used within CodePanelProvider");
    return ctx;
}
