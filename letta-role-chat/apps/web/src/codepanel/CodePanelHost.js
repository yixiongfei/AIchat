import { jsx as _jsx } from "react/jsx-runtime";
// src/codepanel/CodePanelHost.tsx
import { useEffect } from "react";
import { CodeSidePanel } from "../components/CodeSidePanel/index";
import { OPEN_ARTIFACT_EVENT } from "./events";
import { useCodePanel } from "./CodePanelProvider";
export default function CodePanelHost() {
    const { open, width, setWidth, closePanel, artifacts, removeArtifact, clearAllArtifacts, addArtifact, } = useCodePanel();
    useEffect(() => {
        const handler = (e) => {
            const ce = e;
            const detail = ce.detail;
            if (detail?.code) {
                addArtifact({
                    title: detail.title,
                    language: (detail.language || "text").toLowerCase(),
                    code: detail.code,
                    agentName: detail.agentName,
                });
            }
        };
        window.addEventListener(OPEN_ARTIFACT_EVENT, handler);
        return () => window.removeEventListener(OPEN_ARTIFACT_EVENT, handler);
    }, [addArtifact]);
    return (_jsx(CodeSidePanel, { open: open, onClose: closePanel, artifacts: artifacts, onRemoveArtifact: removeArtifact, onClearAll: clearAllArtifacts, width: width, onWidthChange: setWidth, minWidth: 360, maxWidth: 980 }));
}
