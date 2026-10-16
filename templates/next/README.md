# Next.js 宿主模板

把本目录合并到 Next.js App Router 项目后，按目标项目的 alias、UI 组件和鉴权调整导入。

需要在根 `layout.tsx` 增加可选的 `harness` parallel route slot，并在现有 header 或 toolbar 渲染 `components/harness/launcher.tsx` 的 `HarnessLauncher`。以下路由组成完整入口：

| 路径 | 作用 |
| --- | --- |
| `app/harness/page.tsx` | 独立对话页面 |
| `app/@harness/(.)harness/page.tsx` | 从其他页面打开的全局对话弹窗 |
| `app/settings/harness/page.tsx` | Harness 参数和实际 Registry 能力管理 |
| `app/api/harness/chat/route.ts` | 校验来源、会话和 AbortSignal 的 SSE 入口 |

模板里的 `lib/harness/runtime.ts` 只是单进程 Cookie owner 示例。生产应用应接入自己的用户身份、持久化 Store 和权限策略。

`types/harness.ts` 与当前项目的类型 barrel 合并，确保模板组件使用的 `HarnessInitialData`、`HarnessSettingsData` 等类型从目标项目现有 `@/types` 入口导出。

## 对话界面

`components/harness/` 与 NextPier 的 Harness 模板保持一致，以 ViewAI 为样式基准。桌面弹窗宽度上限 1152px、高度 `min(760px, 100dvh - 24px)`，消息与输入区上限 768px；会话侧栏宽 256px，低于 640px 使用带焦点约束的独立侧栏弹层。输入支持自动增高、Enter 发送、Shift+Enter 换行和输入法保护。用户上翻后暂停滚动跟随；等待动画只出现在最后一条无正文的助手消息。

合并时同时更新 `components/ui/dialog.tsx` 的可选 `layout="panel"`、`overlayClassName` 属性，以及 `types/harness.ts` 的 `HarnessSidebarProps`、`HarnessMessagesProps` 及其 barrel 导出。保留宿主主题 token、TooltipProvider 和 MotionConfig。已有工程需要逐项合并新文件 `sidebar.tsx` 及其他对话组件；重复运行准备或升级命令不会自动覆盖已接入代码。
