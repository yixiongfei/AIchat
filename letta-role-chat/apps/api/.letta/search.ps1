# 代码搜索专家 - 快速启动脚本
# 用法: .\search.ps1 [搜索查询]
# 示例: .\search.ps1 "查找所有 API 路由"

param(
    [string]$Query = ""
)

$SEARCH_AGENT_ID = "agent-c475cdfd-3010-4e90-aa7c-ae311199278a"

Write-Host "🔍 启动代码搜索专家..." -ForegroundColor Cyan
Write-Host ""

if ($Query) {
    # Headless 模式：直接执行搜索并返回结果
    Write-Host "📝 搜索查询: $Query" -ForegroundColor Yellow
    Write-Host ""
    letta --agent $SEARCH_AGENT_ID -p $Query --output-format json | ConvertFrom-Json | Select-Object -ExpandProperty result
} else {
    # 交互模式：启动对话
    Write-Host "💡 提示: 你可以直接输入搜索需求，例如：" -ForegroundColor Green
    Write-Host "  - 列出所有 TypeScript 文件" -ForegroundColor Gray
    Write-Host "  - 搜索包含 'deleteMessage' 的代码" -ForegroundColor Gray
    Write-Host "  - 查找所有数据库模型" -ForegroundColor Gray
    Write-Host ""
    letta --agent $SEARCH_AGENT_ID
}
