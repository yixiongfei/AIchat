export function openArtifact(agentName, language, code) {
    // 不传 title，让 CodePanelProvider 自动从代码内容中提取 title: xxx 格式
    // 如果提取不到，会使用 agentName-code-N 格式
    window.dispatchEvent(new CustomEvent("open-artifact", {
        detail: { language, code, agentName },
    }));
}
