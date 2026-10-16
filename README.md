# app-harness

`app-harness` 是一个可嵌入 Web 应用的 Browser Harness 集成工具包。它把会话、消息流、工具注册、Agent、权限、人工确认、运行记录和能力管理抽成可替换的核心，并提供 Next.js App Router 的入口与管理页模板。

它服务于“在现有业务应用中加入一个受控的 AI 对话入口”，不负责浏览器自动化。目标项目继续决定鉴权、数据库、业务 API、页面路由和组件库；迁移工具只提供实现参考和接入证据。

对话模板对齐 ViewAI 的 Harness 样式：紧凑工具栏、桌面会话侧栏与移动侧栏弹层、右侧用户气泡、居中输入区、自动增高输入框、按需滚动跟随和分层关闭。运行中的等待提示在正文出现后消失。

## 用 Prompt 快速接入

直接复制下面的 Prompt，修改「目标项目」和「业务场景」后交给 Codex。业务场景可留空，由 Codex 根据项目现有服务选择真实的只读流程；无需先运行脚本生成 Prompt。

```text
请使用 app-harness 为以下已有项目接入 Browser Harness，并直接完成代码实现。

目标项目：[填写目标项目的绝对路径]
业务场景：[填写希望 Agent 完成的业务流程，可留空]

源码仓库：https://github.com/yayapao/app-harness.git
如果当前工作区已有 app-harness 源码，直接使用；否则用现有 Git 凭据在目标项目之外
通过 git clone --depth 1 获取源码，使用仓库默认分支，不硬编码 main 或 master。
记录实际源码版本，读取 .agents/skills/harness-integrator/SKILL.md 及其引用文档。

读取目标项目规范、路由、鉴权、模型配置、数据库和真实业务服务，保留现有技术栈及用户改动。
在源码目录执行 node scripts/harness.mjs prepare --project "目标项目的绝对路径"，
读取返回迁移包中的 manifest.json、discovery.json 和 INTEGRATE.md，再按 Skill 完成接入。
迁移包必须在源码和目标项目之外；准备命令只用于扫描和打包，随后需要完成实际代码修改。

复用 harness/core、必要的 adapters 与 browser 宿主接口，接入会话、消息流、停止、
人工确认和运行记录。优先复用目标项目已有的服务端模型配置、登录身份和持久化存储。
审核并注册真实业务工具，完成至少一个基础 Agent 和一个有进度、失败及取消处理的可执行流程。
业务场景留空时，从现有服务选择真实的只读查询、核对或汇总流程。
工具和 Agent 必须校验参数、身份和数据范围；写操作经业务鉴权及人工确认。
扫描候选不等于授权，不把演示时间或便签当作业务能力，不提供任意 HTTP、SQL 或 shell 工具。

生成当前业务页可打开的全局对话弹窗入口、独立 /harness 对话页及 /settings/harness 管理页。
管理页并入现有设置导航，展示实际 Registry 注册的 Skill、Agent、工具和上下文能力。
保存模型、运行轮数和输出上限，并确保保存值影响下一次运行。
Next.js App Router 参考 templates/next；其他框架沿用原有 Router 和组件体系实现同等入口。
关闭弹窗、切页或取消时停止消息流，保留键盘、焦点恢复和窄屏交互。

更新目标项目 docs/harness-integration.md 和运行说明，重复接入时增量合并已有插件与权限。
完成允许的静态检查及运行时测试，默认不启动 dev、不 build、不打包。
交付实际修改、入口和管理地址、配置方式、检查结果及具体未验证项。
浏览器与真实模型验收仅在相应环境和授权具备时执行，分别说明结果。
```

同一份 Prompt 及迁移包用法见 [接入 Prompt](docs/integration-prompt.md)。

也可以用脚本生成已填入本仓库路径的 Prompt：

```bash
node scripts/harness.mjs prompt \
  --project /绝对路径/目标项目 \
  --business "可选的真实业务场景"
```

把命令输出交给 Codex。Prompt 会要求读取 `.agents/skills/harness-integrator/SKILL.md`，扫描目标项目、审核真实业务服务，然后生成三类入口：

* 当前业务页里的全局 Harness 对话弹窗；
* `/harness` 完整对话页面；
* `/settings/harness` 管理页面，展示实际 Registry 的工具、Agent、Skill 和上下文，并保存运行参数。

也可以先生成只读迁移包，再把包里的 `INTEGRATE.md` 交给 Codex：

```bash
node scripts/harness.mjs prepare \
  --project /绝对路径/目标项目 \
  --output /绝对路径/目标项目之外的迁移包
```

准备命令只读取目标项目，不安装依赖、不执行候选业务函数、不修改目标项目。迁移包包含 `manifest.json`、`discovery.json`、源码副本和接入 Skill，可脱离本机路径继续使用。

## NextPier 一键接入

NextPier 通过 GitHub 获取本仓库，核心、UI、宿主模板与安装逻辑在 app-harness 维护：

```bash
# 在 NextPier 项目中执行，需要 Git 和 Node.js 20.9+
npm run upgrade:harness
npm run harness:doctor

# 固定源码版本或使用目标工程外的本地 checkout
npm run upgrade:harness -- --ref <tag或完整commit>
npm run upgrade:harness -- --source /path/to/app-harness --skip-install
```

也可在本仓库执行 `node scripts/harness.mjs install-nextpier --project /path/to/nextpier`。安装器沿用 NextPier 的共享 UI、全局 Header、设置布局及根 `harness` 插槽，生成完整页、拦截路由弹窗和管理页，开启 `features.harness`。只有符合该宿主契约的 NextPier 工程适用此命令；其他项目使用上方 Prompt。

首次安装写入 `harness/app-harness.json`，包含工具包版本、Git commit、工作区改动状态和生成内容摘要。重复执行只检查完整性并保留业务修改；旧 `harness/nextpier.json` 继续识别。该命令用于首次接入，不会自动覆盖已接入工程进行升级。详见 [NextPier 接入](docs/nextpier.md)。

## GitHub 与 GitLab 同步维护

[GitHub 开源仓库](https://github.com/yayapao/app-harness) 与公司 GitLab 镜像 `git@git.huya.info:base-front/viewai/app-harness.git` 维护同一套源码和文档。各自保留 Git 历史与 remote，不建立互相依赖的源码分支。

修改完成后，在有改动的那份仓库执行：

```bash
node scripts/mirror.mjs check --target /path/to/另一份app-harness
node scripts/mirror.mjs sync --target /path/to/另一份app-harness
node scripts/mirror.mjs check --target /path/to/另一份app-harness
```

`check` 只读且差异时返回非零状态；`sync` 以当前仓库为准同步受管源码、文档、脚本和依赖清单，移除受管目录中的过期文件，先将目标被替换内容备份到临时目录。先审核目标差异并合并两边需要保留的修改，再同步。Git 信息、node_modules、根环境文件及受管目录之外的文件保持独立。命令不会提交、推送或同步业务工程；两边提交、推送后，各自 CI 执行相同检查。具体分工与日常流程见 [维护说明](docs/nextpier-decoupling.md)。

## 仓库结构

```text
harness/core        框架无关 Gateway、Orchestrator、Registry、Policy 和确认边界
harness/adapters    内存 Store、OpenAI-compatible 模型和演示模型
harness/browser     浏览器运行时、输入校验和 SSE 传输
harness/plugins     仅用于链路验证的示例插件
templates/next      Next.js 对话页、全局弹窗、管理页和宿主参考
profiles/nextpier   NextPier 工程检查与宿主约定
scripts              目标项目扫描、迁移包、安装、Prompt 与镜像同步
.agents/skills      Codex 接入流程与验收约束
```

## 安全边界

候选函数、OpenAPI 操作和 `permissionHint` 只用于发现，不能直接暴露给模型。真实工具必须绑定目标项目的业务鉴权、用户或租户数据范围、严格参数校验和取消信号；写入或破坏性操作必须经过 Gateway 的权限策略和人工确认。不得新增任意 HTTP、SQL、shell 或动态导入工具。

内存 Store 和浏览器 owner Map 仅适合本地演示或单进程开发。生产部署请实现持久化 `HarnessStore`，并让会话、确认与运行记录按登录用户隔离。

## 检查

```bash
npm install
npm test
npm run typecheck
npm run test:harness
node scripts/harness.mjs inspect --project /绝对路径/目标项目
```

`templates/next` 是迁移参考，不是当前仓库自身的 Next.js 应用；实际目标项目的静态检查、运行时测试和浏览器验收由接入 Prompt 依据目标项目规范执行。
