// src/codepanel/events.ts
export type OpenArtifactDetail = {
  title?: string;
  language?: string;
  code?: string;
  agentName?: string;
};

export const OPEN_ARTIFACT_EVENT = "open-artifact";
