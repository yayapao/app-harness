import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverHarnessProject } from './harness-discovery.mjs';

export const harnessSourceEntries = [
  'harness',
  'templates/next',
  'profiles',
  '.agents/skills/harness-integrator',
  'docs/architecture.md',
  'docs/integration-prompt.md',
  'README.md',
  'package.json',
  'LICENSE',
];

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return (
    !relative ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function resolveOutput(input) {
  const parts = [];
  let current = path.resolve(input);
  while (true) {
    try {
      const info = await lstat(current);
      if (!info.isDirectory()) throw new Error('输出路径已存在或不是目录');
      return path.join(await realpath(current), ...parts);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      parts.unshift(path.basename(current));
      current = path.dirname(current);
    }
  }
}

async function collectSource(root, relative, files) {
  const target = path.join(root, relative);
  if (!contains(root, await realpath(target)))
    throw new Error(`源文件越出仓库：${relative}`);
  const info = await lstat(target);
  if (info.isSymbolicLink()) throw new Error(`源文件不能是符号链接：${relative}`);
  if (info.isDirectory()) {
    for (const entry of (await readdir(target)).sort()) {
      if (entry === 'node_modules' || entry === '.git') continue;
      await collectSource(root, path.posix.join(relative, entry), files);
    }
  } else if (info.isFile()) files.push(relative);
  else throw new Error(`不支持的源文件：${relative}`);
}

async function writeNew(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, { flag: 'wx' });
}

export async function prepareHarnessIntegration(project, sourceRoot, options = {}) {
  const source = await realpath(sourceRoot);
  const target = await realpath(project);
  const discovery = await discoverHarnessProject(target);
  const files = [];
  for (const entry of harnessSourceEntries) await collectSource(source, entry, files);
  const pkg = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  if (pkg.name !== 'app-harness') throw new Error('源目录不是 app-harness');

  const destination = options.output ? await resolveOutput(options.output) : null;
  if (
    destination &&
    [source, target].some(
      (root) => contains(root, destination) || contains(destination, root)
    )
  )
    throw new Error('迁移包必须放在 app-harness 和目标项目之外');
  const temporaryRoot = destination ? null : await realpath(os.tmpdir());
  if (
    temporaryRoot &&
    [source, target].some((root) => contains(root, temporaryRoot))
  )
    throw new Error(
      '默认临时目录位于源仓库或目标项目内，请使用 --output 指定外部目录'
    );

  let output;
  if (destination) {
    await mkdir(path.dirname(destination), { recursive: true });
    await mkdir(destination);
    output = destination;
  } else output = await mkdtemp(path.join(temporaryRoot, 'app-harness-kit-'));
  try {
    const inventory = [];
    for (const relative of files) {
      const content = await readFile(path.join(source, relative));
      const destinationFile = path.join(output, 'source', relative);
      await writeNew(destinationFile, content);
      inventory.push({
        path: `source/${relative}`,
        sha256: createHash('sha256').update(content).digest('hex'),
      });
    }
    const manifest = {
      schemaVersion: 1,
      generator: 'app-harness-integration',
      source: 'app-harness',
      sourceVersion: pkg.version,
      project: target,
      strategy: discovery.strategy,
      entrypoint: 'source/.agents/skills/harness-integrator/SKILL.md',
      layers: {
        core: 'source/harness/core',
        adapters: 'source/harness/adapters',
        browser: 'source/harness/browser',
        nextHost: 'source/templates/next',
      },
      dependencies: {
        core: ['zod'],
        openAiAdapter: ['openai'],
        nextTemplate: ['eventsource-parser', 'next', 'react', 'react-dom'],
        optionalUi: ['@animateicons/react', 'framer-motion', 'react-hook-form'],
      },
      files: inventory,
    };
    await writeNew(
      path.join(output, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    await writeNew(
      path.join(output, 'discovery.json'),
      `${JSON.stringify(discovery, null, 2)}\n`
    );
    await writeNew(
      path.join(output, 'INTEGRATE.md'),
      [
        '# Browser Harness 接入任务',
        '',
        `目标项目：${JSON.stringify(target)}`,
        `技术栈建议：${discovery.strategy}`,
        '',
        '这是 app-harness 生成的只读迁移包。先读取 manifest.json、discovery.json，',
        '再读取 source/.agents/skills/harness-integrator/SKILL.md，按迁移包模式实施。',
        'source/harness 提供框架无关核心、模型、Store、权限和确认边界。',
        'source/templates/next 提供 Next.js App Router 的对话入口、全局弹窗和管理页参考。',
        '候选业务函数和 HTTP 操作只供审核，必须完成真实鉴权、参数校验和副作用确认后才注册。',
        '完成真实业务工具、基础 Agent、可执行流程、全局对话框和 Harness 管理页。',
        '',
      ].join('\n')
    );
    return { output, strategy: discovery.strategy, candidateCount: discovery.candidates.length };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}
