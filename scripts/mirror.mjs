#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { mirrorRepositories } from './lib/mirror.mjs';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command] = positionals;
  if (values.help || !command) {
    console.log(
      '用法：node scripts/mirror.mjs check|sync --target <另一份 app-harness 仓库>'
    );
  } else {
    if (
      !['check', 'sync'].includes(command) ||
      positionals.length !== 1 ||
      !values.target
    )
      throw new Error('需要 check 或 sync，以及 --target');
    const source = fileURLToPath(new URL('..', import.meta.url));
    const result = await mirrorRepositories(
      source,
      path.resolve(values.target),
      { write: command === 'sync' }
    );
    if (command === 'sync')
      console.log(
        `已同步 ${result.changed.length} 个文件，移除 ${result.removed.length} 个受管旧文件。备份：${result.backup ?? '无变化'}`
      );
    else if (result.changed.length || result.removed.length) {
      console.error(
        `两仓不一致：\n${result.changed
          .map((file) => `修改/新增 ${file}`)
          .concat(result.removed.map((file) => `多余 ${file}`))
          .join('\n')}`
      );
      process.exitCode = 1;
    } else console.log('两份 app-harness 的受管源码、文档和文件权限完全一致。');
  }
} catch (error) {
  console.error(`[app-harness mirror] ${error.message}`);
  process.exitCode = 1;
}
