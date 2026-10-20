# 对话交互接入

## 指令与引用

`harness/core/composer.ts` 提供 `/` 指令、`@` 引用的光标解析与替换。`/` 从 Registry 的 Skill/Agent 投影候选，点选只准备文本；`@` 与 `+` 使用 ContextProvider 的可选 `search(query, { sessionId?, signal, limit })`。文件、文件夹、项目与收藏夹是宿主注册的类型，不是核心内置业务。

查询返回 `{ type, value, label, description? }`，最多 20 项安全元数据。`value` 是稳定标识，`referenceToken` 编码为 `@type:value`，Gateway 解码后调用 provider.parse/resolve。搜索、解析和真正使用资源时均按当前登录用户、租户/Workspace 校验，客户端标签和选择不是授权。搜索不执行工具或创建聊天。未注册 search 的旧 Provider 仍支持原文本引用。

Next.js 模板已提供 `composer-menu`、`use-references` 和 Server Action `searchHarnessReferences`；替换为宿主授权服务时保留查询上限、取消/旧响应抑制。保留草稿、引用标签去重/移除、Enter/Tab 选择、Esc 只关闭菜单、输入法保护、窄屏滚动及切换会话清空临时引用。`+` 列表来自可搜索 Provider，不硬编码尚未接入的上传等能力。

## 门户 Prompt

需要把集合内的实际入口设计成门户时，使用可选 `createResourcePortalSkill`，并在 Plugin 中注册、加入 Policy 白名单。它只读取宿主授权的数据，调用注入模型的一次结构化任务；不生成 HTML、不发布、不改变归属或权限。

宿主提供 `loadSource(id, ToolContext)`、`model`、`loadConfig()`。源结构为 `{ id, name, total, entries: [{ id, title, description, url, updatedAt?, status? }] }`，最多 100 项有实际入口的资源，total 保留授权范围内真实总数；URL 由服务端生成，使用当前环境的真实路径。不得取最近 N 项就冒充整个收藏夹。禁止把原始文件、名单、凭据或 OSS 地址加入模型。

模型只返回 `{ title, style, grouping, layout, sort, groups: [{ name, entryIds }] }`。内置校验拒绝未知、重复 ID、重复分类名及额外字段，遗漏项归入其他；URL 不进入模型设计输出。宿主可用 `isModelUnavailable` 仅识别超时、未配置或网络故障，返回明确标记的基础方案；授权失败、取消和非法结果不得被该兜底掩盖。

将 `portalActionFromResult` 接入 Gateway 或 Browser Runtime 的 `actionFromToolResult`，与已有投影合并。`portal_design` 事件复用已有 `message_action` 和消息 action 存储；模板卡片支持风格、分类、布局、排序、入口移动及重新推荐。当前编辑即时生成 Prompt，重新打开会话恢复保存的推荐方案。Prompt 包含真实入口、覆盖数、用户当前设置和可编辑的 PORTAL_CONFIG/PORTAL_ITEMS，不执行资源数据中的指令。

生产宿主读取历史 action 前必须重新校验授权及集合成员。Browser Runtime 提供 `authorizeMessageAction(action, sessionId)` 钩子，返回 null 或抛错时隐藏卡片；使用自定义宿主时在其历史接口执行同样检查。历史授权检查不重写保存消息。

## Prompt 交接与快捷跳转

模板 `PromptActions` 默认可复制；传入客户端 `PromptTarget { label, open(prompt) }` 后显示宿主打开入口。已有 ChatGPT 内置按钮时优先复用同一组件，复制和打开读取同一份当前 Prompt，只在用户点击后预填，不自动发送。目标依赖、协议及运行环境由宿主决定，核心不硬编码某个桌面应用。`HarnessPanel.promptTarget` 只能由宿主 Client Component 提供回调，不从 Server Component 传递普通函数。

通用 `prompt_handoff` action 为 `{ type, title, prompt, links?: [{ label, href }] }`，由服务端审核后的结果生成。模板提供圆角跳转入口，拒绝脚本、data URL 和带凭据地址；URL 白名单及业务权限仍由宿主执行，禁止把模型 URL 直接转成操作按钮。打开动作不报告无法检测的“应用唤起成功”。

写操作仍沿用 Gateway 的权限与确认，合理默认值在方案阶段推荐，只在影响范围缺失时追问。发布等成功庆祝属于宿主的业务回执：仅在实际提交成功后触发一次，可复用 Magic UI Confetti，遵循减少动态效果；历史恢复、取消、失败与重试不能误触发。实际业务操作、事务与幂等不进入通用门户规划插件。

验收区分纯函数、模型替身、实际业务与浏览器结果。检查引用越权、旧检索响应、分类伪造、当前编辑复制/打开一致、历史权限失效、390/320px、键盘与减少动态效果；不把静态模板检查描述成真实 ChatGPT 唤起或发布验收。
