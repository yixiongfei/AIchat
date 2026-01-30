
// src/components/CodeSidePanelHost.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CodeSidePanel } from "./CodeSidePanel";

type OpenArtifactDetail = {
    title: string;
    language: string;
    code: string;
};

const STORAGE_KEY = "code_side_panel_width";

export default function CodeSidePanelHost() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState<string>("Code");
    const [language, setLanguage] = useState<string>("text");
    const [code, setCode] = useState<string>("");

    const initialWidth = useMemo(() => {
        const saved = Number(localStorage.getItem(STORAGE_KEY));
        return Number.isFinite(saved) && saved > 0 ? saved : 520;
    }, []);

    const [width, setWidth] = useState<number>(initialWidth);

    const onWidthChange = useCallback((w: number) => {
        setWidth(w);
        try {
            localStorage.setItem(STORAGE_KEY, String(w));
        } catch {
            // ignore
        }
    }, []);

    const onClose = useCallback(() => setOpen(false), []);

    useEffect(() => {
        const handler = (ev: Event) => {
            const ce = ev as CustomEvent<OpenArtifactDetail>;
            const d = ce.detail;

            if (!d || !d.code) return;

            setTitle(d.title || "Code");
            setLanguage((d.language || "text").toLowerCase());
            setCode(d.code || "");
            setOpen(true);
        };

        window.addEventListener("open-artifact", handler as EventListener);
        return () =>
            window.removeEventListener("open-artifact", handler as EventListener);
    }, []);

    return (
        <CodeSidePanel
            open={open}
            onClose={onClose}
            title={title}
            language={language}
            code={code}
            width={width}
            onWidthChange={onWidthChange}
            minWidth={360}
            maxWidth={980}
        />
    );
}
