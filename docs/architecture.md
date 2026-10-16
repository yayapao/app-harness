# Browser Harness 架构

`app-harness` 提供一个可嵌入 Web 应用的对话式 Harness。它的边界是“浏览器里的业务对话与工具编排”，不是浏览器自动化控制器。核心不依赖 Next.js、数据库或某个模型供应商；目标项目通过适配器提供模型、会话存储、身份、权限和业务插件。

## 分层

```text
目标项目 UI / Router
        │ SSE 或宿主流协议
宿主适配层（身份、会话、配置、确认、路由）
        │
harness/browser（运行时、输入校验、SSE 传输）
        │
harness/core（Gateway、Orchestrator、Registry、Policy、Confirmation）
        ├── adapters（Memory Store、OpenAI-compatible、Demo）
        └── 业务 Plugin / Skill / Agent / Tool
```

`HarnessGateway` 负责会话和运行生命周期，`HarnessRegistry` 只暴露显式注册的工具、Agent 和上下文提供者，`HarnessToolPolicy` 决定某个会话可以看到和执行什么。写入和破坏性工具必须经过宿主权限与确认处理；`permissionHint` 或函数名称永远不是授权。

宿主可以使用 `createHarness({ model, store, policy, plugins, config })` 创建核心实例，再把 `gateway.handleChat()` 接到自己的 SSE、WebSocket 或流式响应。`createBrowserHarnessRuntime()` 是面向单个浏览器 owner 的便捷宿主，生产项目通常需要替换它的内存 Store、身份映射和默认插件。

## 接入边界

迁移到目标项目时，只复制 `harness/core`、确实需要的 adapters、`harness/browser` 和 `templates/next` 中与宿主匹配的部分。Next.js 模板包括 `/harness` 完整页面、parallel/intercepting route 的全局弹窗入口以及 `/settings/harness` 管理页；Vue、Svelte 或其他宿主沿用自己的组件和 Router，实现同样的会话流、确认、停止、能力投影和配置保存语义。

默认演示插件的时间和便签只用于验证运行链路，不能作为业务接入结果。真实接入必须记录业务函数、参数契约、身份范围、写入副作用、确认文案和测试证据。

## 多实例部署

内存 Store 和浏览器 owner Map 只适用于本地演示或单进程开发。生产环境应实现持久化 `HarnessStore`，并让会话、确认和运行记录按用户或租户隔离；多进程部署不能依赖进程内 Map 或临时确认状态。
