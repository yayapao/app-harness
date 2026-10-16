#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { discoverHarnessProject } from './lib/harness-discovery.mjs';
import { prepareHarnessIntegration } from './lib/prepare.mjs';
import { integrationPrompt } from './lib/prompt.mjs';
import { installNextPier } from './lib/install-nextpier.mjs';
import { doctorHarness } from '../profiles/nextpier/doctor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    output: { type: 'string' },
    business: { type: 'string' },
    'skip-install': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

function usage() {
  console.log(`用法：
  node scripts/harness.mjs prompt --project <目标项目> [--business <场景>]
  node scripts/harness.mjs prepare --project <目标项目> [--output <迁移包目录>]
  node scripts/harness.mjs inspect --project <目标项目>
  node scripts/harness.mjs install-nextpier --project <NextPier项目> [--skip-install]
  node scripts/harness.mjs doctor --project <NextPier项目>`);
}

async function main() {
  const [command] = positionals;
  if (values.help || !command) {
    usage();
    return;
  }
  if (
    !['prompt', 'prepare', 'inspect', 'install-nextpier', 'doctor'].includes(
      command
    ) ||
    positionals.length !== 1
  )
    throw new Error('未知命令');
  if (!values.project) throw new Error(`${command} 需要 --project`);
  if (values['skip-install'] && command !== 'install-nextpier')
    throw new Error('--skip-install 仅用于 install-nextpier');
  if (values.output && command !== 'prepare')
    throw new Error('--output 仅用于 prepare');
  if (values.business && command !== 'prompt')
    throw new Error('--business 仅用于 prompt');
  const project = path.resolve(values.project);

  if (command === 'doctor') return doctorHarness(project);
  if (command === 'install-nextpier') {
    const result = await installNextPier(project, root);
    if (!values['skip-install']) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.platform === 'win32' ? 'npm.cmd' : 'npm',
          ['install'],
          {
            cwd: project,
            stdio: 'inherit',
            shell: process.platform === 'win32',
          }
        );
        child.once('error', reject);
        child.once('exit', (code) =>
          code === 0
            ? resolve()
            : reject(
                new Error('依赖安装失败；工程已保留，请运行 npm install 后重试')
              )
        );
      });
    }
    console.log(
      `${result.created ? '已接入' : '已配置'} Browser Harness：/harness\n下一步：${values['skip-install'] ? 'npm install，然后 ' : ''}npm run harness:doctor`
    );
    return;
  }

  if (command === 'prompt') {
    console.log(
      integrationPrompt({ source: root, project, business: values.business })
    );
    return;
  }
  if (command === 'inspect') {
    console.log(JSON.stringify(await discoverHarnessProject(project), null, 2));
    return;
  }
  const result = await prepareHarnessIntegration(project, root, {
    output: values.output,
  });
  console.log(
    `迁移包已生成：${result.output}\n技术栈建议：${result.strategy}\n待审核候选工具：${result.candidateCount}\n请把 ${path.join(result.output, 'INTEGRATE.md')} 交给 Codex 继续实施；目标项目未修改。`
  );
}

main().catch((error) => {
  console.error(`[app-harness] ${error.message}`);
  process.exitCode = 1;
});
