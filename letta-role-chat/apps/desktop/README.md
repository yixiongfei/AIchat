# Letta Chat Desktop

Windows 桌面端 AI 聊天工具，基于 Electron 封装现有 Web 版聊天界面，提供桌面置顶、全局快捷键、剪贴板翻译等增强功能。

## 架构

```
┌─────────────────────────────────────────────┐
│  Electron 主进程 (main.ts)                    │
│  ├─ BrowserWindow（置顶无边框聊天窗口）          │
│  ├─ globalShortcut（全局快捷键）                │
│  ├─ Tray（系统托盘）                           │
│  └─ clipboard + translate（剪贴板翻译）         │
│                                               │
│  渲染进程                                      │
│  └─ 加载 apps/web（React 前端，原样复用）        │
│                                               │
│  后端（独立运行，不嵌入 Electron）               │
│  └─ apps/api（Express + MySQL，localhost:3001） │
└─────────────────────────────────────────────┘
```

- Electron 仅作为"壳"，加载现有的 Web 前端页面
- 后端 `apps/api` 独立运行，Electron 通过 HTTP 连接
- 前后端代码零改动，桌面版和 Web 版共存

## 功能

### 1. 桌面置顶迷你聊天窗

- 无边框窗口（自定义拖拽区域）
- 始终置顶显示（always on top）
- 默认尺寸 420x620，可自由拖拽缩放
- 关闭按钮 → 最小化到系统托盘（不退出）

### 2. 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `Alt+Space` | 切换聊天窗口 显示/隐藏 |
| `Ctrl+Shift+T` | 翻译剪贴板中文 → 日文 |

### 3. 剪贴板翻译

按下 `Ctrl+Shift+T` 后自动执行：

1. 读取剪贴板文本
2. 检测是否包含中文
3. 调用后端 AI 翻译接口（中文 → 日文）
4. 翻译结果写回剪贴板（直接 Ctrl+V 粘贴）
5. 弹出系统通知显示翻译结果

### 4. 系统托盘

- 托盘图标常驻
- 左键点击 → 显示/隐藏窗口
- 右键菜单 → 显示窗口 / 退出应用

## 目录结构

```
apps/desktop/
├── README.md                # 本文档
├── package.json             # 依赖与脚本
├── tsconfig.json            # TypeScript 配置
├── electron-builder.yml     # 打包配置
└── src/
    ├── main.ts              # Electron 主进程入口
    ├── preload.ts           # IPC 桥接脚本
    └── translate.ts         # 剪贴板翻译模块
```

## 开发

### 前置条件

- Node.js >= 18
- 后端 `apps/api` 运行中（`localhost:3001`）
- 前端 `apps/web` 开发服务器运行中（`localhost:5173`）

### 安装依赖

```bash
cd apps/desktop
npm install
```

### 启动开发模式

需要 3 个终端同时运行：

```bash
# 终端 1：后端
cd apps/api && npm run dev

# 终端 2：前端
cd apps/web && npm run dev

# 终端 3：Electron 桌面端
cd apps/desktop && npm run dev
```

开发模式下 Electron 加载 `http://localhost:5173`，支持热更新。

## 打包

### 构建前端

```bash
cd apps/web && npm run build
```

### 打包 Windows 安装包

```bash
cd apps/desktop && npm run build
```

产物在 `apps/desktop/release/` 目录下，包含 `.exe` 安装程序。

> 注意：打包后的桌面端仍需要后端 `apps/api` 独立运行。可配合系统服务或启动脚本一并启动。

## 配置

环境变量（可选）：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_DEV_URL` | `http://localhost:5173` | 开发模式前端地址 |
| `API_BASE_URL` | `http://localhost:3001` | 后端 API 地址 |
