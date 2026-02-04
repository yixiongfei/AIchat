
// src/codepanel/CodePanelHost.tsx
import React, { useEffect } from "react";
import { CodeSidePanel } from "../components/CodeSidePanel/index";
import { OPEN_ARTIFACT_EVENT, OpenArtifactDetail } from "./events";
import { useCodePanel } from "./CodePanelProvider";

export default function CodePanelHost() {
  const {
    open,
    width,
    setWidth,
    closePanel,
    artifacts,
    removeArtifact,
    clearAllArtifacts,
    addArtifact,
  } = useCodePanel();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<OpenArtifactDetail>;
      const detail = ce.detail;
      if (detail?.code) {
        addArtifact({
          title: detail.title || "Code",
          language: (detail.language || "text").toLowerCase(),
          code: detail.code,
        });
      }
    };
    window.addEventListener(OPEN_ARTIFACT_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_ARTIFACT_EVENT, handler as EventListener);
  }, [addArtifact]);

  return (
    <CodeSidePanel
      open={open}
      onClose={closePanel}
      artifacts={artifacts}
      onRemoveArtifact={removeArtifact}
      onClearAll={clearAllArtifacts}
      width={width}
      onWidthChange={setWidth}
      minWidth={360}
      maxWidth={980}
    />
  );
}
