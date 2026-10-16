# app-harness 双仓维护与 NextPier 接入

GitHub `yayapao/app-harness` 和公司 GitLab `base-front/viewai/app-harness` 保存同一份工具包内容。NextPier 直接从 GitHub 获取源码，不依赖内网访问或 npm 发布。

## 职责

| 位置 | 维护内容 |
| --- | --- |
| 两份 app-harness | 核心、适配器、Next.js 模板、安装器、发现工具、迁移包、完整 Skill、Prompt、测试 |
| NextPier | 外部源码获取与转发、可选开关、Header 入口、根布局插槽、设置导航、集成测试 |
| 生成后的业务工程 | 模型配置、身份与权限、业务插件、数据库与 Store、实际页面和流程 |

NextPier 已移除 `templates/harness`、重复扫描/打包/安装实现和完整接入 Skill。共享基础组件仍属 NextPier 设计系统。安装器只生成 Harness 专属路径，不覆盖共享 UI、常规设置、根布局或 Header。

## 使用方式

```bash
# NextPier 项目中
npm run upgrade:harness
npm run harness:doctor

# 用确定的版本首次接入
npm run upgrade:harness -- --ref <tag或完整commit>

# 联合开发：使用目标项目外的本地源码
npm run upgrade:harness -- --source /path/to/app-harness --skip-install
npm install
```

默认从 GitHub 仓库的默认分支浅 clone 到临时目录；固定 ref 时 fetch 该 ref 并 detached checkout。源码通过校验后调用 app-harness CLI，最终清理外部临时目录。取源失败时不会生成目标代码。

首次安装记录 `harness/app-harness.json`，包括 profile、工具包版本、实际 commit、工作区是否有改动、生成内容摘要和文件清单。开发中的本地源码即使 commit 相同，也可通过内容摘要区分。新工程带有本地 doctor，不依赖后续 GitHub 可用性。

重复执行只验证文件清单并保留源代码；旧 `harness/nextpier.json` 继续有效，不把旧工程伪装成新版本。该命令不是自动更新器。已有业务工程升级时，使用固定版本的 app-harness 与 Prompt 对照合并，保留自定义插件、鉴权和存储，再重新验证。

任意其他项目使用 [可复制 Prompt](integration-prompt.md)。NextPier 的 `harness:prepare` 只是转发兼容入口，迁移包和候选发现逻辑仍在 app-harness。

## 日常迭代

1. 从 ViewAI 或 Niu 阅读改进，提取适合多个项目的实现，进入任意一份 app-harness；业务代码保留在原工程。
2. 运行工具包检查和 NextPier 临时工程集成测试。模板检查使用 `APP_HARNESS_SOURCE=/path/to/app-harness npm run test:harness-template`，不启动 dev/build。
3. 对比另一份仓库的差异，先合并两边应保留的修改，再从完成修改的仓库执行 `mirror.mjs sync --target <另一份仓库>`。
4. 执行 `mirror.mjs check`，确认受管源码、文档、依赖清单和文件权限一致。分别审核 Git diff，按各自仓库提交、推送；Git 历史与 commit SHA 可以不同。
5. NextPier 新工程直接从 GitHub 接入；需要固定验收版本时使用 tag 或 commit。现有工程显式合并和验证。

`sync` 按当前仓库内容更新受管文件，先备份目标中被修改或移除的内容，再移除受管目录中的过期文件；备份目录会显示在输出中。它不改 `.git`、remote、node_modules 或根环境文件，不执行提交和推送。同步前必须先处理目标中独立进行的有效修改。命令仅管理固定清单；新增顶层共享目录时同步更新 `scripts/lib/mirror.mjs`。

两个仓库源码一致不代表已经发布。GitHub 未推送工具包前，NextPier 默认取源无法使用新安装器；本地联调可通过 `--source` 验证。

## 检查范围

工具包测试覆盖候选发现与迁移包边界、安装/幂等/冲突/旧工程兼容、双仓校验和同步。NextPier 测试覆盖源码获取、默认分支/tag/commit、临时目录清理、参数转发、初始化不携带 Harness 实现。完整临时工程检查覆盖生成后的 TypeScript、ESLint、SSE 与核心运行时。

浏览器入口、真实业务服务、模型连通性和生产持久化需要在实际业务工程验收；这些不由源码同步或 demo 测试替代。
