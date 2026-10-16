# Browser Harness

应用内的 AI 对话运行时，沿用 Niu 的 Gateway、Orchestrator、Registry 与插件架构。浏览器负责交互，服务端调用模型和工具。

给非 NextPier 或已有业务工程接入时，使用 [跨项目接入 Prompt](integration-prompt.md) 和 app-harness 的 `harness-integrator` Skill。`npm run harness:prepare -- --project /path/to/target` 准备源码包与候选工具报告，再由 Codex 按目标技术栈完成业务工具、Agent、流程、对话入口和管理页。

## 一条命令接入

在已安装 npm 依赖的 NextPier 项目根目录执行：

```bash
npm run upgrade:harness
npm run harness:doctor
```

CLI 生成源码、注册类型、打开导航入口，并执行 `npm install`，增加 `openai`、`eventsource-parser` 和开发依赖 `tsx`。顶部对话图标在当前业务页打开 AI 对话弹窗；直接访问 `/harness` 显示完整对话页。全局设置中的 `/settings/harness` 提供运行参数与已注册能力管理；旧 `/harness/settings` 跳转到该页面。

已有 dev 服务时重新加载页面；未启动时执行 `npm run dev`。集成命令本身不启动服务、不调用模型、不构建。

只生成文件、稍后安装依赖：

```bash
npm run upgrade:harness -- --skip-install
npm install
```

重复执行保留已生成的源码和业务修改。未知目录、同名脚本或文件冲突会使命令退出；生成中途失败会回滚本次文件和元数据。安装依赖失败时工程保留，重新运行 `npm install` 即可。

## 对话与管理

顶部入口通过 `app/@harness/(.)harness/page.tsx` 拦截路由打开 shadcn Dialog，保留背景页面；关闭、浏览器后退返回原页面，前进可重新打开。刷新 `/harness` 后显示完整页。默认路由、首页空路由和兜底路由均返回 `null`，进入管理页或其他页面时清除弹窗。两种对话视图复用会话列表、消息流、输入、确认、能力与运行记录；再次进入时选择最近的会话，关闭时中止当前消息流并保留已保存记录。

对话弹窗沿用 ViewAI 的布局和交互：760px 视口约束面板、256px 会话侧栏、窄屏侧栏弹层、居中消息与输入区、右侧用户气泡和自动增高输入框。只在最后一条助手消息尚无正文时显示等待动画；上翻历史后停止自动跟随，回到底部恢复。侧栏和运行记录关闭后恢复入口焦点；确认弹窗关闭后回到可用的输入或停止按钮。

管理页的模型、运行限额和单轮输出上限使用 Halo Input，桌面上排在一行。服务端校验模型名称、1–32 轮和 256–64000 tokens；运行中拒绝修改，保存后 Gateway 在下一次运行读取配置。演示模式固定使用 `demo` 模型，不能通过输入框变成真实模型。

已注册能力按 Skill 展示 Halo Card 的标题与描述，点击同宽 Popover 查看对应 Agent 和工具。名称、描述、Skill 关系、权限及确认标记由 Registry 从代码注册定义投影；写入和删除始终显示需确认。默认工作台插件包含三个工具和便签上下文，没有 Agent。能力卡片不提供独立运行入口。

设置页复用常规设置的侧栏与窄屏导航。管理数据只传入模式、参数和注册能力，不将会话消息和运行日志带入管理表单。模型、运行限额与输出上限使用 Halo Input，Agent / 工具使用 Halo Tabs；保存用 Texture Button，顶部入口、返回、恢复、关闭及对话工具使用 AnimateIcons。

Halo Input、Halo Card 和 Popover 沿用 Niu 的 token 适配与稳定定位：静止锚点、真实宽高、局部入场动画、单弹层切换、焦点恢复及减少动态效果，具体约束见 [NextPier 组件与样式](https://github.com/yayapao/nextpier/blob/main/docs/design-system.md)。

已有项目不会由重复升级自动覆盖。迁移旧模板时，先合并新 UI 组件、`components/settings/`、`app/settings/layout.tsx`、常规设置和 `app/settings/harness/`，再合并 `components/harness/`、兼容管理路由、运行配置、Registry 投影和 `app/@harness/`。根 `app/layout.tsx` 接收可选 `harness: React.ReactNode` 并在 Provider 内渲染 `{harness}`；顶部补齐 `HeaderActions`。保留业务插件、鉴权和存储；没有根插槽时链接只会进入完整页。本次对话样式还需合并新增 `components/harness/sidebar.tsx`、Dialog 的 `layout="panel"` 与 `overlayClassName` 支持，并在 `types/index.ts` 导出 `HarnessSidebarProps` 和 `HarnessMessagesProps`。CLI 只占用 `app/settings/harness/`，不覆盖其余设置与布局；已有自定义插槽或设置路由须逐项合并。

## 先试演示，再接模型

默认 `HARNESS_MODE=demo`，无需 API Key。示例提供读取当前时间、读取便签和确认后保存便签；演示模型按固定规则调用工具，不是 LLM。

真实模型配置写入 `.env.local`，变量模板由 CLI 生成在 `.env.harness.example`：

```dotenv
HARNESS_MODE=openai
HARNESS_MODEL=你的模型名称
OPENAI_API_KEY=你的密钥
# 可选，按服务商填写完整 API 基础地址
OPENAI_BASE_URL=https://api.openai.com/v1
```

修改后重启 Web 或桌面应用。模型须支持 Chat Completions 的流式输出与工具调用；密钥只在服务端使用，不加 `NEXT_PUBLIC_` 前缀。适配器沿用 Niu 的 OpenAI 兼容 SDK 实现，工具调用格式见 [OpenAI 官方文档](https://developers.openai.com/api/docs/guides/function-calling)。

`harness:doctor` 检查文件、依赖和环境配置，不发送模型请求。

## 分层与目录

```text
浏览器界面 → Server Actions / SSE → Gateway → Orchestrator → Registry / Plugin
                                           ↘ Model / Store / Policy / Cache
```

| 路径                            | 职责                                             |
| ------------------------------- | ------------------------------------------------ |
| `harness/core/`                 | 会话编排、注册、权限、确认、事件、缓存与运行追踪 |
| `harness/adapters/`             | 内存存储、演示模型与 OpenAI 兼容模型             |
| `harness/plugins/workbench.ts`  | 示例工具和 `@note:ID` 上下文提供者               |
| `harness/browser/`              | 当前浏览器的会话边界、宿主配置与 SSE 编码        |
| `lib/harness/runtime.ts`        | Next.js Cookie 身份与进程内运行时注册            |
| `app/harness/`                  | Server Component 页面和会话、确认、停止操作      |
| `app/harness/settings/`         | 旧管理地址及 Server Action 兼容入口              |
| `app/settings/harness/`         | 统一设置内的管理页与参数保存                     |
| `app/@harness/`                 | 当前业务页的对话弹窗、默认和兜底空路由           |
| `app/api/harness/chat/route.ts` | `POST` 消息流                                    |
| `components/harness/`           | 对话、输入、确认、能力列表和运行记录             |
| `types/harness.ts`              | 界面共享类型，从 `types/index.ts` 导出           |
| `harness/app-harness.json`      | CLI 来源与集成标记                                     |
| `nextpier.config.json`          | `features.harness` 导航开关                      |

安装源为 `https://github.com/yayapao/app-harness.git`，NextPier 不再内置模板。支持 `--ref <tag或完整commit>` 固定版本，或 `--source /path/to/app-harness` 从外部本地 checkout 安装。首次安装记录实际 commit 与内容摘要；重复安装保留源码，旧标记继续兼容。新工程自带离线 doctor；旧工程可指定本地源码运行检查。

核心不依赖 Next.js、数据库或股票业务。它输出类型化事件，由 SSE 适配器发送到界面；消息解析使用 `eventsource-parser`。源码出处见生成后的 `harness/ORIGIN.md`。

## 接入业务能力

在 `harness/plugins/` 增加插件，将其注册到 `harness/browser/runtime.ts` 的 `plugins`，并同步更新 `allowedTools`。工具参数在 handler 内使用 Zod 校验。

`HarnessPlugin` 下的 Skill 可以提供 `tools`、可调用 `agents` 和 `contextProviders`。注册名称必须唯一。`@note:ID` 是上下文解析示例；业务可换成工单、客户或文档引用。

只读工具设置 `permission: 'read'`；写入用 `write`，删除用 `destructive`。后两者强制人工确认，宿主未提供确认处理器时拒绝执行。工具在展示给模型时和实际执行前均检查权限。

自定义运行时沿用以下接口：

```ts
import { HarnessGateway } from '@/harness/core';

const gateway = new HarnessGateway({
  config: { model: 'your-model', maxIterations: 8, maxTokens: 2048 },
  model: yourModel,
  store: yourStore,
  plugins: [yourPlugin],
  policy: { authorize: (tool, sessionId) => canUseTool(tool, sessionId) },
  tracePayloads: false,
});
```

`yourModel`、`yourStore`、`yourPlugin`、`canUseTool` 由业务提供。核心接口为 `HarnessModel`、`HarnessStore`、`HarnessToolPolicy` 和 `HarnessCacheStore`；前端只引用类型与事件，不导入模型适配器。

## 会话边界

默认通过随机 HttpOnly Cookie 隔离浏览器会话；消息流还校验 Origin 与会话归属。Server Actions 负责新建、读取、删除、确认和停止。工具确认仍属于授权浏览器的操作，不代替业务鉴权。

当前模板使用内存存储：会话、便签、日志、运行配置及待确认状态在进程重启后丢失。配置和会话按浏览器隔离，重启后参数恢复默认。每个浏览器最多 40 个会话，示例便签最多 100 条；单次运行默认 8 轮、2048 tokens，最多 120 秒。日志默认不记录模型和工具载荷。

公开业务应用需要将浏览器示例身份替换为现有登录用户，并在业务工具和存储层校验权限。需要历史记录时替换 Store，数据写入 `NEXTPIER_DATA_DIR` 或数据库；同一活动会话的请求须到同一进程，多实例部署需要共享运行状态与确认通道。

## 与 Wails 一起使用

两种升级可独立执行，也可叠加：

```bash
npm run upgrade:harness
npm run upgrade:wails -- --name MyApp --id com.example.myapp
```

桌面客户端继续通过本地 Next.js 处理 Server Actions 和 SSE。桌面模型配置写入应用用户配置目录的 `.env.local`，路径见 [NextPier 桌面指南](https://github.com/yayapao/nextpier/blob/main/docs/desktop.md)。默认内存会话同样随应用退出丢失。

## 验证

基础仓库：

```bash
npm run test:cli
npm run test:harness-template
```

第二条命令在临时目录安装测试所需的 SDK 与解析器，生成完整工程，执行 TypeScript、ESLint 和核心、模型适配器、SSE、配置生效与能力关系测试。需要 npm 缓存或网络；不启动 Next.js、不请求真实模型，结束后清理临时目录。

已升级的业务项目：

```bash
npm run typecheck
npm run lint
npm run test:harness
```

测试覆盖写入确认、取消与停止、断开消息流、权限拒绝、会话归属、缓存隔离、配置生效、能力投影、设置目录冲突及回滚。浏览器验收需检查全局设置导航、主题保存与重载、当前页打开弹窗、直达与刷新、前进后退、进入管理页后无残留弹层、同宽 Popover、快速切换和焦点恢复；真实模型连通性和 Wails 原生窗口仍需分别验收。

[NextPier 建项 Prompt](https://github.com/yayapao/nextpier/blob/main/docs/ai-agent.md) · [NextPier 开发指南](https://github.com/yayapao/nextpier/blob/main/docs/development.md) · [app-harness](../README.md)
