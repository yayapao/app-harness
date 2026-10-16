# app-harness 维护约定

- 先读 README.md、docs/architecture.md；接入业务项目时读 `.agents/skills/harness-integrator/SKILL.md`。遵守目标项目自己的规范，保留已有改动。
- GitHub 开源版与公司 GitLab 版共用相同源码、Prompt、Skill、模板和测试。修改任意一份后，先审核并合并另一份需要保留的差异，再运行 `node scripts/mirror.mjs sync --target <另一份仓库>` 和 `check`。保留各自 `.git`、remote、凭据和本地依赖；同步不等于提交或推送。
- NextPier 只维护外部接入命令与宿主入口；不要把核心、UI、发现脚本或完整 Skill 复制回 NextPier 模板仓库。安装器位于 `scripts/lib/install-nextpier.mjs`。
- 通用能力进入核心或适配器，业务代码留在目标项目。保留上游来源和许可证；不得把公司业务、凭据或本机数据放入共同源码。
- 已接入工程的代码由使用者维护。重复安装只校验并保留修改；兼容旧 `harness/nextpier.json`，不静默覆盖业务插件、权限或会话存储。
- 单个代码文件不超过 360 行，按职责拆分。默认不启动 dev、build 或打包。
- 修改后运行 `npm test`、`npm run typecheck`、`npm run test:harness` 和 `git diff --check`。宿主模板或安装器变化时，在 NextPier 用 `APP_HARNESS_SOURCE=<源码目录> npm run test:harness-template` 验证完整工程；不以核心 typecheck 代替模板验证。
- README.md 与 docs/integration-prompt.md 的可复制 Prompt 保持一致，只让用户填写目标项目和业务场景。分别报告静态检查、运行时、浏览器与真实模型的验证情况。
