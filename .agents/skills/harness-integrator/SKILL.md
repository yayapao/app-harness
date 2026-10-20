---
name: harness-integrator
description: 将 app-harness Browser Harness 接入现有项目，发现并审核业务工具，开发基础 Agent 和流程，生成全局对话框与 Harness 管理页。适用于跨项目迁移和已有接入的增量完善。
---

# Harness 项目接入

在用户指定的目标项目内完成可运行的 Harness 接入。模板提供 TypeScript 核心、模型和存储适配器、Next.js 宿主以及 React UI 参考。目标项目决定目录、语言、路由、鉴权和组件系统。

工具包的说明文档统一维护在 [aiwiki/app-harness](https://github.com/yayapao/aiwiki/tree/main/app-harness)。本 Skill 与 references 是随代码发布的执行规则，迁移包保留它们，接入不依赖访问 aiwiki；不要在 app-harness 代码仓库恢复说明文档。

## 取得源码与证据

先确认目标项目、源码位置及用户要求的业务场景。读取目标项目适用的 AGENTS.md、依赖、路由、服务层、鉴权和测试命令；保留工作区改动。源码位置可以是用户指定的本地 app-harness checkout 或 Git 仓库；读取模板不意味着用模板规范替换目标项目规范。

Git 源仓库模式：使用用户或当前版本接入 Prompt 指定的仓库，在目标项目之外获取源码，并记录来源及实际 commit。未指定来源时默认使用 `https://github.com/yayapao/app-harness.git`；指定了其他来源时不得自行切换到 GitHub。浅 clone 仓库默认分支，不硬编码 `main` 或 `master`；用户指定分支或 tag 时用 `git clone --depth 1 --branch <版本>`，指定完整 commit SHA 时使用普通 clone 或按该 SHA fetch 后 `git checkout --detach <SHA>`。私有仓库只使用现有 Git 凭据，不把 token 写入 URL、Prompt、迁移包或日志。不要把 `blob`/`raw` 单文件 URL 当作完整源码，因为它不包含脚本、引用文档和 UI 依赖。

本地源仓库模式：如果已有 app-harness checkout，验证其 Git 根目录、origin 与指定来源一致、目标版本符合要求后复用；不能只按目录名选择其他来源的 checkout。在任意工作目录执行准备命令：

```bash
node "/path/to/app-harness/scripts/harness.mjs" prepare --project "/path/to/target"
```

Git checkout 准备完成后，使用同一条命令，将源目录替换为实际 clone 目录。源目录、迁移包和目标项目必须相互独立。

读取命令返回的迁移包中的 manifest.json 和 discovery.json。命令不修改目标项目，不安装依赖，不执行发现的工具。无 TypeScript 依赖时只有文件与 OpenAPI 发现，继续用 rg 和源码阅读补齐符号；扫描截断、跳过的大文件和其他语言须补查。

迁移包模式：若用户已经给出 INTEGRATE.md 或迁移包目录，读取包内 manifest.json、discovery.json，并将包内 source/ 当作源码参考；不要再次准备，也不要依赖 manifest.source 指向的原机器路径。技能的 references/ 随包保留。

参考 [宿主适配](references/host-adapters.md) 选择接入方式；阅读 [能力与验收](references/capabilities.md) 完成真实业务接入。

任务涉及输入器、文件/项目/收藏夹引用、门户设计、Prompt 交接或对话内跳转时，阅读 [对话交互](references/conversation-ui.md)。核心已提供通用契约与 Next.js 组件；按目标业务选用，不复制 ViewAI 的 OA、数据表或发布逻辑。

## 完成接入

1. 根据证据写入目标项目的 docs/harness-integration.md。记录宿主方案、模型配置来源、身份与会话映射、存储、扫描范围、候选工具的源码文件与符号、鉴权、副作用、接入或排除理由。候选发现不是授权；不得批量把导出函数或 HTTP 接口暴露给模型。
2. 复用包内 harness/core 和 adapters 的实现，将 Cookie、Server Actions、路由与前端请求替换为目标宿主接口。已有 Harness 时做增量合并，保留自定义 Store、业务插件、权限和旧地址。非 Node 后端优先复用现有 Node 服务或部署可用的 Node 适配服务；部署不支持 Node 时明确该实际阻碍，不承诺可直接运行 TypeScript。
3. 从实际业务里选择最小闭环，开发参数校验、业务鉴权、取消和数据范围正确的工具。注册真实插件和权限白名单，替换演示时间/便签能力。未注册或外部未配置的能力不显示为可用。
4. 实现基础业务 Agent 和一个可执行流程。未指定业务目标时，根据现有服务选择只读的查询、核对或汇总流程；Agent 必须调用真实业务服务并返回结果，流程必须有输入、执行步骤、进度、失败与取消处理。不能只写角色 Prompt、空 execute 或虚构结果。Agent 内所有调用的副作用必须与 Agent 权限匹配，读 Agent 不得间接写入；写入步骤分离为经 Gateway 确认的工具。
5. 在现有全局工具栏增加对话框入口，复用会话、消息流、确认和记录；关闭、切页或会话切换时取消流，保留正确的焦点、滚动、窄屏和键盘行为。生成 Harness 管理页并接入现有全局设置导航，保留直达地址。参数保存须实际影响后续运行；能力、Agent、工具及确认状态来自 Registry。
6. React 项目优先复用 AnimateIcons 和 Cult UI 的 Halo Input、Card、Tabs、Popover、Texture Button，适配现有 token、尺寸、依赖版本和减少动态效果。其他前端沿用自己的控件与图标体系，实现同等交互，不强行引入 React。保留复用代码的许可证和来源。
7. 合并目标项目依赖、脚本和文档，用其包管理器安装确实需要的依赖。补齐真实工具、Agent/流程、鉴权拒绝、确认取消、流停止、参数生效和 UI 注册关系测试。运行目标项目允许的静态和运行时检查；未授权启动服务、build 或打包时不执行这些命令。

NextPier 工程的 `npm run upgrade:harness` 默认从 GitHub 获取本工具包；使用其他来源时必须传入 `-- --source <对应的本地checkout>`，或在该 app-harness 源码目录运行 `node scripts/harness.mjs install-nextpier --project <NextPier项目>`。自动安装只适用于保留入口开关、根布局插槽与共享组件的 NextPier 宿主；任意已有工程使用上述迁移流程。不要将整个 app-harness 工程覆盖到目标项目，不在目标业务工程运行模板 init.mjs。不要新增允许模型任意调用 HTTP、SQL、shell 或动态导入模块的通用工具。

## 交付

交付实际修改、工具与 Agent 清单、可执行流程、入口和管理地址、配置方式、检查结果。docs/harness-integration.md 保留已接入的源码映射和待验证项，便于下一次重复 Prompt 增量完善。区分静态检查、运行时测试、浏览器验收与真实模型检查；缺少密钥或运行环境时说明具体未验证项，不能用 demo 结果代替真实接入。
