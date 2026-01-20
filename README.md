# Letta Role Chat Project (Cloud Version)

这是一个基于 **Vite + React** 前端和 **Express** 后端构建的 Letta 角色聊天应用。后端作为代理层，连接到 **Letta Cloud**，并支持流式（Streaming）消息传输。

## 架构概览

本项目采用 Monorepo 结构，使用 `pnpm workspace` 管理，包含以下主要部分：

| 模块 | 技术栈 | 描述 |
| :--- | :--- | :--- |
| `apps/web` | Vite, React, TypeScript, TailwindCSS | 前端用户界面，负责角色选择、会话管理和聊天窗口的展示。 |
| `apps/api` | Express, TypeScript, Letta SDK | 后端 API 服务，负责代理前端请求到 Letta Cloud，并处理流式消息转发。 |
| `packages/shared` | TypeScript (可选) | 共享类型定义等。 |

**关键依赖**：
*   **Letta SDK**: 用于与 Letta Cloud 通信。
*   **Express**: 构建后端 API。
*   **React**: 构建前端 UI。

## 目录结构

```
letta-role-chat/
├── apps/
│   ├── web/                           # Vite + React 前端
│   └── api/                           # Express 后端（代理 Letta Cloud）
├── packages/
│   └── shared/                        # 共享 types / zod schema
├── pnpm-workspace.yaml
└── README.md
```

## 部署与运行

### 1. 环境准备

确保您的环境中安装了 Node.js 和 pnpm。

```bash
# 安装 pnpm (如果尚未安装)
npm install -g pnpm
npm install -g ts-node-dev # 后端开发依赖
```

### 2. 获取 Letta Cloud API Key

请访问 [Letta Cloud](https://app.letta.com) 获取您的 API Key。

### 3. 安装依赖

在项目根目录运行：

```bash
pnpm install
```

### 4. 配置环境变量

**后端 (`apps/api`)**

创建 `apps/api/.env` 文件，内容如下：

```
# Letta Cloud API 地址
LETTA_BASE_URL=https://api.letta.com

# 您的 Letta Cloud API Key
LETTA_API_KEY=your_actual_api_key_here

# Express 服务器端口
PORT=3001
```

**前端 (`apps/web`)**

创建 `apps/web/.env` 文件，内容如下：

```
# 指向 Express 后端 API
VITE_API_BASE_URL=http://localhost:3001/api
```

### 5. 启动服务

在项目根目录运行以下命令，将同时启动前端和后端服务：

```bash
pnpm dev
```

*   **后端服务 (Express)** 将运行在 `http://localhost:3001`。
*   **前端服务 (Vite)** 将运行在 `http://localhost:3000`。

打开浏览器访问 `http://localhost:3000` 即可开始使用。

## 核心功能实现

### 后端 (Express)

*   **Letta 客户端初始化**: 在 `apps/api/src/letta/client.ts` 中，`LettaClient` 使用 `token` 参数进行 API Key 鉴权，并指向 `https://api.letta.com`。
*   **角色管理**: `apps/api/src/letta/agent.service.ts` 封装了 Letta Agent 的创建。
*   **流式消息**: `apps/api/src/letta/message.service.ts` 实现了流式消息转发。

### 前端 (Vite + React)

*   **API 封装**: `apps/web/src/services/api.ts` 负责处理 SSE 格式的流式响应。
*   **聊天窗口**: `apps/web/src/components/ChatWindow.tsx` 实时渲染流式消息。
