
// src/codepanel/CodePanelHost.tsx
import React, { useEffect } from "react";
import { CodeSidePanel } from "../components/CodeSidePanel";
import { OPEN_ARTIFACT_EVENT, OpenArtifactDetail } from "./events";
import { useCodePanel } from "./CodePanelProvider";

export default function CodePanelHost() {
  const { open, title, language, code, width, setWidth, openPanel, closePanel } = useCodePanel();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OpenArtifactDetail>;
      openPanel(ce.detail || {});
    };
    window.addEventListener(OPEN_ARTIFACT_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ARTIFACT_EVENT, handler as EventListener);
  }, [openPanel]);

  return (
    <CodeSidePanel
      open={open}
      onClose={closePanel}
      title={title}
      language={language}
      code={code}
      width={width}
      onWidthChange={setWidth}
      minWidth={360}
      maxWidth={980}
    />
  );
}
