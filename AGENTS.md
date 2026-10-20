# app-harness maintenance

- This is the GitHub code repository. Keep its Git history, origin, credentials, and local dependencies separate from the company GitLab checkout. Preserve existing changes.
- Maintain all explanatory documentation in `/Users/yango/github/agents/aiwiki/app-harness`, published at https://github.com/yayapao/aiwiki/tree/main/app-harness. Keep architecture, integration prompts, host guides, usage, and maintenance notes there. Do not create `docs/`, template READMEs, or long guides in this code repository.
- Keep this AGENTS.md, a short README linking to aiwiki, executable Skill instructions and their required references, and source/license notices with the code. The company internal repository also does not maintain explanatory documentation. Do not overwrite either repository's README or AGENTS during code synchronization.
- Maintain generic core, adapters, templates, discovery, installer, and Skill code here; business services, authentication, model credentials, and persistence belong to the target application. Respect the target project's own instructions.
- The integration kit must work without aiwiki access. Do not add wiki files or retired documentation paths as required inputs to `prepare` or installation. Keep portable Skill references and licenses intact.
- NextPier owns source acquisition and host entries; app-harness owns the implementation. Existing target code is maintained by its users; repeat installation must preserve plugins, policies, and storage.
- Keep each code file under 360 lines. Do not start dev servers, builds, or packaging by default.
- Run `npm test`, `npm run typecheck`, `npm run test:harness`, and `git diff --check` after changes. For template or installer changes, also run NextPier's `APP_HARNESS_SOURCE=<source checkout> npm run test:harness-template`. Report static, runtime, browser, and real-model checks separately.
