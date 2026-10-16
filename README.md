# app-harness

> **An AI-native browser workspace for your existing web app.**
>
> Give your users a governed AI assistant that can understand context, call approved business tools, stream progress, and ask for confirmation before it changes data.

[![CI](https://github.com/yayapao/app-harness/actions/workflows/check.yml/badge.svg)](https://github.com/yayapao/app-harness/actions/workflows/check.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`app-harness` is a framework-neutral Browser Harness toolkit for adding an AI conversation layer to a real product. The core keeps model access, tool execution, permissions, approvals, sessions, and run history behind explicit interfaces. A Next.js App Router template provides a polished chat surface, a global dialog entry, and a capability management page.

## Why it exists

Most AI demos stop at a chat box. Production apps need a controlled execution layer between a model and business data. app-harness gives that layer a small, inspectable contract:

- **Agents with real work** — connect a model to reviewed tools and executable workflows.
- **Safe tool boundaries** — every tool declares its permission and confirmation policy; writes fail closed without authorization.
- **Streaming UX** — stream text, tool progress, confirmations, cancellations, and run records through typed events.
- **Context aware sessions** — isolate browser owners, sessions, messages, approvals, and cached reads.
- **Drop-in web UI** — use the Next.js template for `/harness`, an in-place dialog, mobile session navigation, and `/settings/harness`.
- **Bring your own stack** — keep your existing auth, database, router, model provider, and design system.

## Start in minutes

Requirements: Node.js 20.9+ and npm.

```bash
git clone https://github.com/yayapao/app-harness.git
cd app-harness
npm install
npm test
npm run typecheck
npm run test:harness
```

The repository is a toolkit and reference implementation. It does not start a server or modify another project during these checks.

## Add it to an existing app

Use the built-in read-only scanner to prepare a portable integration kit:

```bash
node scripts/harness.mjs prepare \
  --project /absolute/path/to/your-app \
  --output /absolute/path/to/app-harness-kit
```

Then give the generated `INTEGRATE.md` to Codex or another coding agent. It contains a source inventory, discovered business candidates, hashes, the integration skill, and the host references needed to implement the work in the target project.

For a NextPier project, the installer creates the chat page, intercepted dialog route, settings page, runtime, and dependency wiring:

```bash
node scripts/harness.mjs install-nextpier \
  --project /absolute/path/to/nextpier-app \
  --skip-install
cd /absolute/path/to/nextpier-app
npm install
npm run harness:doctor
```

Pin a tag or commit with `--ref`. During local development, use `--source /absolute/path/to/app-harness`; the source checkout must stay outside the target app.

The generated entry points are:

- `/harness` — the full conversation workspace.
- The global Harness launcher — an in-place dialog that keeps the current page visible.
- `/settings/harness` — model limits and the registered capability registry.

## Copy-paste prompt

Replace the two bracketed values and send the prompt to your coding agent:

```text
请使用 app-harness 为以下已有项目接入 Browser Harness，并直接完成实现。

目标项目：[填写目标项目的绝对路径]
业务场景：[填写希望 Agent 完成的业务流程，可留空]

源码仓库：https://github.com/yayapao/app-harness.git
先读取仓库中的 .agents/skills/harness-integrator/SKILL.md 和引用文档，再运行：
node scripts/harness.mjs prepare --project "目标项目的绝对路径"

读取迁移包的 manifest.json、discovery.json 和 INTEGRATE.md。保留目标项目现有技术栈、鉴权、数据层、路由和用户改动，审核真实业务服务后注册最小工具，完成一个基础 Agent 和一个可执行流程。

生成当前业务页的全局对话弹窗、/harness 完整对话页和 /settings/harness 管理页。工具必须有参数校验、身份与数据范围检查；写入和删除必须经过业务鉴权与人工确认。不要提供任意 HTTP、SQL、shell 或动态导入能力。

完成允许的静态检查和运行时测试，默认不启动 dev、不 build、不打包。交付实际修改、入口、管理地址、配置方式、检查结果和未验证项。
```

The full prompt and migration format are documented in [`docs/integration-prompt.md`](docs/integration-prompt.md).

## Architecture

```text
Web UI
  │  Server Actions / SSE
  ▼
Gateway ── Orchestrator ── Registry ── reviewed tools and agents
  │             │
  ├─ Policy     ├─ Model adapter
  ├─ Confirm    ├─ Session store
  └─ Run log    └─ Browser transport
```

The framework-neutral runtime lives under [`harness/`](harness). Host-specific reference code lives under [`templates/next/`](templates/next). The core never imports Next.js, a database driver, or a product-specific service.

## Safety contract

Discovery output is a review queue, not permission to expose a function. Register only tools that have a real business owner, strict input validation, user and tenant scope checks, cancellation handling, and a declared side-effect policy. Write and destructive operations require an explicit confirmation handler. Do not give a model arbitrary HTTP, SQL, shell, filesystem, or dynamic-import access.

The included memory store and browser owner map are suitable for local development and demos. Production deployments should provide a durable, user-isolated store and connect the runtime to the host application's authentication boundary.

## Model configuration

The demo adapter works without a key. For an OpenAI-compatible provider, configure the server environment:

```dotenv
HARNESS_MODE=openai
HARNESS_MODEL=your-model
OPENAI_API_KEY=your-secret
OPENAI_BASE_URL=https://api.openai.com/v1
```

Keep secrets server-side. Never use a `NEXT_PUBLIC_` prefix for model credentials.

## Development

```bash
npm test                 # CLI, discovery, installer, and integration tests
npm run typecheck        # framework-neutral TypeScript
npm run test:harness     # core, adapters, streaming, policy, and browser tests
node scripts/harness.mjs inspect --project /absolute/path/to/your-app
```

Contributions should keep the core framework-neutral, preserve the explicit permission boundary, and include tests for any changed execution or integration contract.

## License

MIT. See [`LICENSE`](LICENSE).
