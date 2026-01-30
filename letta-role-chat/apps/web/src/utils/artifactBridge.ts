// src/utils/artifactBridge.ts
export type OpenArtifactDetail = {
  title: string;
  language: string;
  code: string;
};

export function openArtifact(title: string, language: string, code: string) {
  window.dispatchEvent(
    new CustomEvent<OpenArtifactDetail>("open-artifact", {
      detail: { title, language, code },
    })
  );
}
