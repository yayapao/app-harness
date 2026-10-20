# app-harness

An AI-native Browser Harness toolkit for governed in-app agents, tools, streaming conversations, approvals, and Next.js interfaces.

[![CI](https://github.com/yayapao/app-harness/actions/workflows/check.yml/badge.svg)](https://github.com/yayapao/app-harness/actions/workflows/check.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Documentation

All guides are maintained in [AI Wiki / app-harness](https://github.com/yayapao/aiwiki/tree/main/app-harness):

- [Overview and setup](https://github.com/yayapao/aiwiki/blob/main/app-harness/overview.md)
- [Integration prompt](https://github.com/yayapao/aiwiki/blob/main/app-harness/integration-prompt.md)
- [Architecture](https://github.com/yayapao/aiwiki/blob/main/app-harness/architecture.md)
- [NextPier integration](https://github.com/yayapao/aiwiki/blob/main/app-harness/nextpier.md)
- [Commands, references, and portal prompts](https://github.com/yayapao/aiwiki/blob/main/app-harness/conversation-design.md)

This repository maintains the GitHub code distribution, a short README, AGENTS, executable Skills, and source/license notices. Explanatory documentation belongs in AI Wiki.

## Development

Requires Node.js 20.9+ and npm.

```bash
git clone https://github.com/yayapao/app-harness.git
cd app-harness
npm install
npm test
npm run typecheck
npm run test:harness
```

The integration kit includes its own source and Skill instructions and works without AI Wiki access.

MIT. See [LICENSE](LICENSE).
