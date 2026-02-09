# 代码搜索专家 Agent

## 基本信息
- **Agent ID**: `agent-c475cdfd-3010-4e90-aa7c-ae311199278a`
- **名称**: 代码搜索专家
- **模型**: Claude Haiku（快速且经济）
- **工具集**: 只读工具（Glob, Grep, Read）
- **创建时间**: 2026-02-09

## 用途
专门用于快速搜索和分析代码库，具备以下能力：
- 🔍 查找文件（按文件名模式）
- 📝 搜索代码内容（按正则表达式）
- 📖 读取文件详细内容
- 📊 分析代码结构和依赖关系

## 快速使用

### 方法1：通过 CLI 直接使用
```bash
# 启动搜索 agent
letta --agent agent-c475cdfd-3010-4e90-aa7c-ae311199278a

# 或使用 headless 模式（编程调用）
letta --agent agent-c475cdfd-3010-4e90-aa7c-ae311199278a -p "搜索所有包含 'deleteMessage' 的文件" --output-format json
```

### 方法2：通过 Task 工具（在其他 agent 中调用）
```javascript
// 在主 agent 中部署搜索 agent
Task({
  agent_id: "agent-c475cdfd-3010-4e90-aa7c-ae311199278a",
  subagent_type: "explore",  // 使用只读工具集
  description: "搜索特定代码",
  prompt: "查找所有数据库模型文件"
})
```

### 方法3：通过消息传递（messaging-agents skill）
```bash
# 发送消息给搜索 agent
/msg agent-c475cdfd-3010-4e90-aa7c-ae311199278a "帮我找到所有 API 路由文件"
```

## 常用搜索命令示例

### 查找文件
- "列出所有 TypeScript 文件"
- "查找所有包含 'service' 的文件"
- "找到配置文件（*.config.js, *.config.ts）"

### 搜索代码内容
- "搜索所有包含 'deleteMessage' 函数的文件"
- "查找所有数据库模型定义"
- "找到所有 API 路由的定义"
- "搜索错误处理相关的代码"

### 分析代码
- "分析 message.service.ts 的功能"
- "查看数据库表结构"
- "列出所有 API 接口"

## 配置信息
- **Persona**: 代码搜索专家，快速准确地定位代码
- **工作风格**: 简洁高效、结构清晰
- **只读原则**: 永不修改代码，仅提供搜索和分析结果

## 管理命令

### 更新记忆
```bash
letta --agent agent-c475cdfd-3010-4e90-aa7c-ae311199278a -p "/memory update persona '新的描述'"
```

### 查看对话历史
```bash
letta messages list --agent agent-c475cdfd-3010-4e90-aa7c-ae311199278a
```

### 删除 Agent（如果不再需要）
```bash
# 注意：删除前请确认
letta agents delete --agent agent-c475cdfd-3010-4e90-aa7c-ae311199278a
```

---

**提示**: 这个 agent 使用 Haiku 模型，响应速度快且成本低，非常适合频繁的代码搜索任务。
