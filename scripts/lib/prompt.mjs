import path from 'node:path';

export function integrationPrompt({ source, project, business = '' }) {
  const sourcePath = JSON.stringify(source);
  const projectPath = JSON.stringify(project);
  const skillPath = JSON.stringify(
    path.join(source, '.agents/skills/harness-integrator/SKILL.md')
  );
  const scriptPath = JSON.stringify(path.join(source, 'scripts/harness.mjs'));
  return `请将 app-harness Browser Harness 接入目标项目并直接完成实现。

app-harness 源仓库：${sourcePath}
目标项目：${projectPath}
业务场景：${business || '从目标项目现有业务选择一个真实的只读闭环'}

先读取 ${skillPath}，严格按该 Skill 执行。
先运行：node ${scriptPath} prepare --project ${projectPath}
读取迁移包的 manifest.json、discovery.json 和 INTEGRATE.md；目标项目本身必须保留技术栈、鉴权、数据库、路由及用户改动。

复用迁移包 source/harness/core、source/harness/adapters 和 source/harness/browser，按目标项目宿主实现会话、消息流、停止、确认、运行记录和配置读取。
从真实业务服务审核并注册最小工具，至少实现一个基础 Agent 和一个可执行流程；候选函数、OpenAPI 操作和 permissionHint 都不是授权。所有写操作必须同时具备业务鉴权、参数校验、显式确认和可追溯结果，模型不得获得任意 HTTP、SQL、shell 或动态导入能力。

生成用户入口：
1. 当前业务页的全局 Harness 对话框入口，关闭、切页和取消请求时停止消息流，窄屏可用；
2. 直接访问 /harness 的完整对话页面；
3. /settings/harness 管理页面，展示实际 Registry 的工具、Agent、Skill、上下文能力，保存模型、运行轮数和输出上限，并确保保存值影响下一次运行。
Next.js App Router 优先参考 source/templates/next 的 parallel/intercepting route；其他框架按原 Router 实现同等入口，不强行引入 Next.js 组件。

把接入记录写入目标项目 docs/harness-integration.md，说明宿主、身份映射、存储、模型配置、真实工具和未验证项。运行目标项目允许的静态检查、Harness 测试及浏览器检查；默认不启动 dev、不 build、不打包。交付实际修改、入口地址、管理地址、配置方式和验证结果，区分静态检查、运行时测试、浏览器验收和真实模型检查。`;
}
