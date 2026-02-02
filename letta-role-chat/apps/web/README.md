# Letta 角色聊天 - 前端

一个现代化、功能丰富的 AI 角色扮演聊天界面，集成高级语音合成、代码显示和 Live2D 功能。

## 🌟 功能特性

- ✅ **多角色聊天**：管理多个具有不同个性的 AI 角色
- ✅ **语音合成**：集成 TTS（文本转语音）并支持自定义语音设置
- ✅ **Live2D 集成**：桌面端动画角色显示
- ✅ **代码高亮**：长代码块自动在侧边栏显示并支持语法高亮
- ✅ **图片上传**：对话中支持图片上传
- ✅ **长文本粘贴**：超长文本自动转为附件上传（>2000字符或>50行）
- ✅ **响应式设计**：移动端和桌面端优化
- ✅ **深色/浅色主题**：主题切换并支持系统偏好检测
- ✅ **实时流式传输**：流式消息响应
- ✅ **历史管理**：持久化对话历史
- ✅ **文本选择朗读**：选中文本朗读功能

## 📁 项目结构

```
apps/web/src/
├── components/          # React 组件
│   ├── AssistantMessageContent.tsx  # AI 回复内容渲染
│   ├── ChatWindow.tsx   # 主聊天界面（使用 useChatStream）
│   ├── CodeArtifactCard.tsx         # 代码卡片组件
│   ├── CodeSidePanel.tsx            # 代码侧边栏
│   ├── CodeSidePanelHost.tsx        # 侧边栏宿主
│   ├── ComposerPreview.tsx          # 输入预览区（图片+代码+文本附件）
│   ├── FloatingCodeButton.tsx       # 浮动代码按钮
│   ├── Markdown.tsx                 # Markdown 渲染
│   ├── MessageBubble.tsx            # 消息气泡
│   ├── MobileTopBar.tsx             # 移动端顶栏
│   ├── RoleEditor.tsx               # 角色编辑器
│   ├── RoleList.tsx                 # 角色列表
│   └── SelectionTTSButton.tsx       # 选中文本朗读按钮
│
├── codepanel/          # 代码显示系统
│   ├── CodePanelHost.tsx            # 事件监听宿主
│   ├── CodePanelProvider.tsx        # 状态提供器
│   └── events.ts                    # 事件类型定义
│
├── hooks/              # 自定义 React Hooks
│   ├── useChatStream.ts  # ⭐ 核心：聊天流逻辑（含长文本附件处理）
│   ├── useIsMobile.ts    # 移动端检测
│   ├── useLive2D.ts      # Live2D 集成
│   ├── useResizableSidebar.ts  # 可调整侧边栏
│   ├── useRoles.ts       # 角色管理
│   ├── useTextSelectionTTS.ts  # 选中文本朗读
│   ├── useTheme.ts       # 主题切换
│   └── useTTS.ts         # 语音合成
│
├── services/           # API 服务
│   └── api.ts          # 后端 API 封装（含附件上传）
│
├── types/              # TypeScript 类型定义
│   └── index.ts        # Role, Message, MessageAttachment 等类型
│
├── utils/              # 工具函数
│   ├── artifactBridge.ts     # 代码构件事件桥
│   ├── codeSegmentation.ts   # 代码块解析
│   └── live2dBridge.ts       # Live2D 消息桥
│
├── App.tsx             # 主应用组件
├── main.tsx            # 应用入口
├── index.css           # 全局样式
└── vite-env.d.ts       # Vite 类型定义
```

## 📄 文件说明

### 核心组件

#### `App.tsx`
编排整个 UI 的主应用组件：
- 布局管理（侧边栏、聊天区域、代码面板）
- 角色选择和管理
- 主题处理
- 移动端/桌面端响应式行为
- 代码面板集成

#### `components/ChatWindow.tsx` ⭐
主聊天界面组件，使用 `useChatStream` hook 管理核心逻辑：
- **布局管理**：头部、消息区、输入区三段式布局
- **消息渲染**：使用 MessageBubble 组件渲染对话
- **输入处理**：
  - 文本输入（自动高度调整）
  - 图片上传（通过 useChatStream）
  - 代码块预览（通过 ComposerPreview）
- **TTS 控制**：自动朗读开关、停止按钮
- **流式控制**：停止生成按钮
- **暴露 API**：通过 ref 暴露 `toggleAutoSpeak`、`stopSpeak`、`clearHistory`
- **样式定制**：通过 props 自定义各区域样式

#### `components/MessageBubble.tsx`
单条消息渲染器：
- 显示用户和助手消息
- 以网格布局显示上传的图片
- 长消息折叠/展开
- 与代码显示系统集成
- 点击放大图片

#### `components/RoleList.tsx`
角色管理侧边栏组件：
- 显示所有可用角色及头像
- 角色选择
- 创建新角色按钮
- 编辑现有角色
- 选中角色的视觉反馈

#### `components/RoleEditor.tsx`
创建/编辑角色的模态表单：
- 角色名称和个性配置
- 语音设置（语音、语速、音调、风格）
- 头像上传及预览
- 验证和错误处理
- 异步保存及加载状态

#### `components/ComposerPreview.tsx`
输入框预览区组件（图片 + 代码卡片）：
- 显示待发送的图片预览
- 显示输入文本中解析出的代码块
- 代码块折叠/展开功能
- 图片删除按钮
- 复用于 ChatWindow 输入区

#### `components/FloatingCodeButton.tsx`
可拖拽的代码面板浮动按钮：
- 拖动重新定位
- 点击切换代码面板
- 防止拖拽时误触点击
- 记住位置
- 触摸友好

#### `components/CodeSidePanel.tsx`
代码显示侧边栏：
- 使用 Prism 语法高亮
- 可调整宽度
- 复制到剪贴板
- 行号显示
- 多语言支持
- 键盘快捷键（ESC 关闭）

#### `components/MobileTopBar.tsx`
移动端专用顶部导航：
- 角色信息显示
- 快速访问控制
- 自动朗读开关
- 清空历史
- 侧边栏菜单按钮

### 代码面板系统

#### `codepanel/CodePanelProvider.tsx`
代码面板状态的上下文提供器：
- 全局状态管理
- 面板开关控制
- 宽度持久化（localStorage）
- 内容管理（标题、语言、代码）

#### `codepanel/CodePanelHost.tsx`
监听代码显示事件的宿主组件：
- 监听 `open-artifact` 事件
- 长代码块自动打开面板
- 与 ChatWindow 集成

#### `codepanel/events.ts`
代码显示系统的事件类型定义

### Hooks

#### `hooks/useChatStream.ts` ⭐ 核心 Hook
聊天流核心逻辑 Hook，ChatWindow 组件的核心依赖：
- **状态管理**：
  - `messages`：消息历史
  - `input`：输入框内容
  - `isLoading`：加载状态
  - `autoSpeak`：自动朗读开关
  - `uploadedImages`：已上传图片列表
  - `textAttachments`：文本附件列表（长文本粘贴自动生成）
  - `inputCodeCards`：输入框中解析的代码卡片
  - `collapsedMap`：代码卡片折叠状态
  - `expandedMap`：历史消息展开状态
- **核心功能**：
  - `send()`：发送消息（含图片和附件支持）
  - `cancelStream()`：取消流式响应
  - `clearHistory()`：清空对话历史
- **TTS 集成**：
  - 自动朗读开关
  - 流式文本智能分段
- **图片上传**：
  - `handleImageUpload()`：处理图片上传
  - `removeImage()`：删除图片
  - `openFileDialog()`：打开文件选择器
- **长文本附件**：
  - `handlePastedText()`：处理长文本粘贴（>2000字符或>50行自动转附件）
  - `removeTextAttachment()`：删除文本附件
  - `shouldConvertToAttachment()`：判断是否应转为附件
- **优化特性**：
  - O(1) 流式消息更新
  - 请求 ID 机制防止过期响应
  - 代码块自动解析

#### `hooks/useTTS.ts`
高级 TTS（文本转语音）Hook：
- **功能特性**：
  - 流式文本支持
  - 智能分段（在标点处暂停）
  - 代码过滤
  - 音频队列管理
  - 性能缓存
  - 并发请求去重
- **选项**：
  - 语音、语速、音调、风格
  - 分段的最小/最大长度
  - 防抖时间
  - 句子检测

#### `hooks/useRoles.ts`
角色管理 Hook：
- 从 API 加载角色
- 创建新角色
- 更新现有角色
- 与 Letta Cloud 同步
- 选中角色状态

#### `hooks/useTheme.ts`
主题管理：
- 深色/浅色模式切换
- 系统偏好检测
- localStorage 持久化
- DOM 类操作

#### `hooks/useLive2D.ts`
Live2D 角色集成：
- 仅桌面端显示
- 动态脚本加载
- 移动端检测和清理
- CDN 集成

#### `hooks/useTextSelectionTTS.ts`
文本选择转语音：
- 检测文本选择
- 定位浮动按钮
- 朗读选中文本
- 防抖更新

#### `hooks/useResizableSidebar.ts`
可调整大小的侧边栏功能：
- 拖动调整大小
- 宽度约束（最小/最大）
- localStorage 持久化
- 鼠标事件处理

#### `hooks/useIsMobile.ts`
移动端检测工具：
- 可配置断点
- 窗口大小调整监听
- 返回移动端状态布尔值

### 服务

#### `services/api.ts`
与后端通信的 API 客户端：
- **角色管理**：
  - `getRoles()`：获取所有角色
  - `createRole()`：创建带头像的新角色
  - `updateRole()`：更新角色设置
  - `syncRoles()`：与 Letta Cloud 同步
  
- **消息**：
  - `sendMessageStream()`：发送消息并接收流式响应
  - `getHistory()`：加载对话历史
  - `deleteHistory()`：清空对话
  
- **媒体**：
  - `deleteAudio()`：清理 TTS 音频文件
  - 头像 URL 转换

### 类型

#### `types/index.ts`
TypeScript 类型定义：

```typescript
interface Role {
  id: string;
  name: string;
  persona: string;
  human: string;
  agentId?: string;
  avatar?: string;
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
  createdAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  images?: string[];  // ✅ 新增：图片支持
}
```

### 工具函数

#### `utils/codeSegmentation.ts`
代码块检测和分段：
- 从 markdown 提取围栏代码块
- 检测长代码（按行数/字符数）
- 将消息拆分为可渲染的片段
- 为折叠消息生成预览

#### `utils/live2dBridge.ts`
Live2D 小部件桥接：
- `showWaifuMessage()`：在 Live2D 角色上显示消息
- `showWaifuStreamUpdate()`：流式传输的节流更新
- `clearWaifuTimers()`：清理
- 消息显示的优先级系统

#### `utils/artifactBridge.ts`
代码构件系统的事件桥接：
- 为代码显示分发自定义事件
- 类型安全的事件详情

## 🚀 快速开始

### 前置要求

- Node.js 18+ 和 npm
- 后端 API 运行中（查看后端 README）

### 安装

```bash
cd apps/web
npm install
```

### 开发

```bash
npm run dev
```

应用将在 `http://localhost:5173`（默认 Vite 端口）可用。

### 生产构建

```bash
npm run build
```

构建文件将在 `dist/` 目录中。

## 🎨 样式

项目使用 **Tailwind CSS** 进行样式设计，采用自定义深色主题：

- **主色调**：蓝色（`blue-600`）
- **背景**：板岩色调（`slate-50` 到 `slate-950`）
- **深色模式**：自动跟随系统偏好
- **自定义滚动条**：深色背景主题
- **响应式**：移动优先方法

### 主题类

```css
/* 浅色模式背景 */
bg-slate-50, bg-slate-100

/* 深色模式背景 */
dark:bg-slate-900, dark:bg-slate-950

/* 主要操作 */
bg-blue-600 hover:bg-blue-700

/* 文本颜色 */
text-slate-900 dark:text-slate-100
```

## 🔧 配置

### TTS 设置

在 `RoleEditor` 中或按角色配置：
- **语音**：Azure TTS 语音 ID（例如：`ja-JP-MayuNeural`）
- **语速**：0.25-4.0（默认：1.0）
- **音调**：字符串值（例如："15"）
- **风格**：语音风格（例如："chat"、"cheerful"）

### 代码显示阈值

在 `utils/codeSegmentation.ts` 中：

```typescript
const DEFAULT_THRESHOLDS = {
  CODE_LINE_THRESHOLD: 30,      // 移至侧边栏前的行数
  CODE_CHAR_THRESHOLD: 1200,    // 移至侧边栏前的字符数
  TEXT_CHAR_THRESHOLD: 2000,    // 折叠消息前的字符数
};
```

## 📱 移动端支持

- 可折叠侧边栏及遮罩
- 触摸友好控件
- 响应式排版
- 优化布局
- Live2D 自动禁用

## 🎯 关键功能说明

### 图片上传

1. 点击输入栏中的 `+` 按钮
2. 选择一张或多张图片（每张最大 10MB）
3. 预览出现在输入框上方
4. 悬停在图片上显示删除按钮
5. 图片随消息发送

### 代码显示

长代码块自动在侧边栏打开：
- 语法高亮
- 行号
- 复制按钮
- 可调整宽度
- 键盘快捷键（ESC 关闭）

### 语音合成

- **自动朗读**：在标题栏切换
- **选择朗读**：选择文本并点击浮动按钮
- **智能分段**：在标点处暂停
- **代码过滤**：朗读时跳过代码块
- **缓存**：重复短语重用音频

### Live2D 集成

- 仅桌面端（移动端自动禁用）
- 显示 AI 消息
- 角色动画
- 点击交互

## 🔌 API 集成

前端通过 REST API 与后端通信：

```typescript
// 示例：发送流式消息
await api.sendMessageStream(
  roleId,
  message,
  (chunk) => {
    // 处理每个响应片段
  },
  () => {
    // 处理完成
  }
);
```

查看 `services/api.ts` 了解所有可用端点。

## 🐛 常见问题

### 图片无法上传
- 检查文件大小（最大 10MB）
- 验证文件类型是否为 image/*
- 检查浏览器控制台错误

### TTS 不工作
- 验证后端 TTS 端点可访问
- 检查浏览器控制台音频错误
- 确保语音设置有效

### 代码面板无法打开
- 检查 ChatWindow 中的 `autoOpenLongCode` 属性
- 验证 CodePanelProvider 包裹了 App
- 检查浏览器控制台事件错误

## 📚 依赖项

### 核心
- **React 18**：UI 框架
- **TypeScript**：类型安全
- **Vite**：构建工具
- **Tailwind CSS**：样式

### UI 库
- **lucide-react**：图标库
- **react-syntax-highlighter**：代码高亮
- **markdown-it**：Markdown 解析
- **dompurify**：HTML 清理

### 工具
- **Live2D Widget**：角色动画（CDN）
- **Azure TTS**：语音合成（后端）

## 🤝 贡献

1. 创建功能分支
2. 进行更改
3. 在桌面和移动端彻底测试
4. 提交 Pull Request

## 📄 许可证

[您的许可证]

## 🔗 相关链接

- 后端 README：`../../backend/README.md`
- API 文档：[API 文档链接]
- Live2D Widget：https://github.com/stevenjoezhang/live2d-widget

---

**用 ❤️ 构建，使用 React、TypeScript 和 Tailwind CSS**