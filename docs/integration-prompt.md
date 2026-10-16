# 接入 Prompt

## 直接复制

修改下面的「目标项目」和「业务场景」后，整段交给 Codex。业务场景可留空；无需先运行脚本生成 Prompt。源码会优先使用当前工作区的 app-harness，未找到时由 Codex 获取仓库。

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

## 脚本生成

在本仓库根目录运行下面的命令生成一份已填入路径的 Prompt：

```bash
node scripts/harness.mjs prompt --project /绝对路径/目标项目 --business "可选的业务场景"
```

## 迁移包

只读扫描并生成迁移包：

```bash
node scripts/harness.mjs prepare --project /绝对路径/目标项目 --output /绝对路径/外部迁移包
```

把迁移包里的 `INTEGRATE.md` 和 `source/.agents/skills/harness-integrator/SKILL.md` 交给 Codex。准备命令只读取目标项目，不安装依赖、不运行候选工具、不修改目标项目；重复接入时保留已有插件、权限和路径，按清单增量合并。

Prompt 要求目标项目最终具备三类入口：当前业务页的全局对话弹窗、独立 `/harness` 对话页和 `/settings/harness` 管理页。管理页的能力列表必须来自运行时 Registry，不能把扫描候选伪装成可用工具。
