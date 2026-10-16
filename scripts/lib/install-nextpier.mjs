import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cp,
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
import { promisify } from 'node:util';
import { validateInstallation } from '../../profiles/nextpier/doctor.mjs';

const run = promisify(execFile);
const scripts = {
  'harness:doctor': 'node scripts/harness.mjs doctor',
  'test:harness':
    'tsx --test harness/core/*.test.ts harness/adapters/*.test.ts harness/tests/*.test.ts',
};
const typeExport =
  "export type { HarnessInitialData, HarnessConversationSummary, HarnessChatState, HarnessPanelProps, HarnessSidebarProps, HarnessMessagesProps, HarnessCapabilityCardProps, HarnessCapabilityDetailsProps, HarnessSettingsData } from './harness';";
const mappings = [
  ['harness', 'harness'],
  ...[
    'lib/harness',
    'components/harness',
    'app/harness',
    'app/settings/harness',
    'app/@harness',
    'app/api/harness',
    'types/harness.ts',
    '.env.harness.example',
  ].map((entry) => [`templates/next/${entry}`, entry]),
  ['profiles/nextpier/doctor.mjs', 'harness/doctor.mjs'],
];

async function exists(file) {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function rejectLinks(root, relative) {
  const parts = relative.split('/');
  for (let count = 1; count <= parts.length; count++) {
    const entry = path.join(root, ...parts.slice(0, count));
    if ((await exists(entry)) && (await lstat(entry)).isSymbolicLink())
      throw new Error(`集成路径不能是符号链接：${relative}`);
  }
}

async function listFiles(root, relative = '') {
  const info = await lstat(path.join(root, relative));
  if (info.isSymbolicLink()) throw new Error(`模板包含符号链接：${relative}`);
  if (info.isFile()) return [relative];
  if (!info.isDirectory()) throw new Error(`不支持的模板文件：${relative}`);
  const files = [];
  for (const entry of (await readdir(path.join(root, relative))).sort())
    files.push(...(await listFiles(root, path.posix.join(relative, entry))));
  return files;
}

async function sourceIdentity(source, temporary) {
  const pkg = JSON.parse(
    await readFile(path.join(source, 'package.json'), 'utf8')
  );
  if (pkg.name !== 'app-harness') throw new Error('源目录不是 app-harness');
  const files = await listFiles(temporary);
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\0`);
    hash.update(await readFile(path.join(temporary, file)));
  }
  let commit = null;
  let dirty = null;
  try {
    commit = (
      await run('git', ['rev-parse', 'HEAD'], { cwd: source })
    ).stdout.trim();
    dirty = Boolean(
      (
        await run(
          'git',
          ['status', '--porcelain', '--untracked-files=normal'],
          { cwd: source }
        )
      ).stdout.trim()
    );
  } catch {
    /* A portable source kit need not have Git metadata. */
  }
  return {
    repository: 'https://github.com/yayapao/app-harness.git',
    version: pkg.version,
    commit,
    dirty,
    contentSha256: hash.digest('hex'),
  };
}

export async function installNextPier(project, sourceRoot) {
  const root = await realpath(project);
  const source = await realpath(sourceRoot);
  if (
    root === source ||
    root.startsWith(`${source}${path.sep}`) ||
    source.startsWith(`${root}${path.sep}`)
  )
    throw new Error('app-harness 源码必须位于目标项目之外');
  if (await validateInstallation(root)) return { created: false };
  for (const file of ['package.json', 'nextpier.config.json', 'types/index.ts'])
    await rejectLinks(root, file);
  const packagePath = path.join(root, 'package.json');
  const packageSource = await readFile(packagePath, 'utf8');
  const pkg = JSON.parse(packageSource);
  if (!pkg.dependencies?.next || !pkg.dependencies?.zod)
    throw new Error('请在已安装 NextPier 的项目根目录执行');
  for (const [, relative] of mappings) {
    // Refuse symlink ancestors as well as existing files before any target writes.
    const parts = relative.split('/');
    for (let count = 1; count <= parts.length; count++) {
      const entry = parts.slice(0, count).join('/');
      const target = path.join(root, entry);
      if (await exists(target)) {
        if ((await lstat(target)).isSymbolicLink() || count === parts.length)
          throw new Error(`${entry} 已存在，拒绝覆盖`);
      }
    }
  }
  for (const [name, value] of Object.entries(scripts))
    if (pkg.scripts?.[name] && pkg.scripts[name] !== value)
      throw new Error(`${name} 已存在，拒绝覆盖`);
  const configPath = path.join(root, 'nextpier.config.json');
  const typePath = path.join(root, 'types/index.ts');
  const configSource = await readFile(configPath, 'utf8');
  const config = JSON.parse(configSource);
  if (!config.features || typeof config.features.harness !== 'boolean')
    throw new Error('nextpier.config.json 缺少 features.harness 开关');
  const typeSource = await readFile(typePath, 'utf8');
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'app-harness-install-')
  );
  const installed = [];
  try {
    for (const [from, to] of mappings) {
      if (!(await exists(path.join(source, from))))
        throw new Error(`Harness 模板缺少 ${from}`);
      await rejectLinks(source, from);
      await listFiles(source, from);
      await cp(path.join(source, from), path.join(temporary, to), {
        recursive: true,
      });
    }
    const files = await listFiles(temporary);
    if (!files.includes('app/harness/page.tsx'))
      throw new Error('Harness 模板不完整');
    const identity = await sourceIdentity(source, temporary);
    const paths = mappings.slice(0, -1).map(([, to]) => to);
    for (const relative of paths) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      installed.push(target);
      await cp(path.join(temporary, relative), target, {
        recursive: true,
        errorOnExist: true,
        force: false,
      });
    }
    const dependencies = {
      ...pkg.dependencies,
      openai:
        pkg.dependencies.openai ?? pkg.devDependencies?.openai ?? '^7.4.0',
      'eventsource-parser':
        pkg.dependencies['eventsource-parser'] ??
        pkg.devDependencies?.['eventsource-parser'] ??
        '^3.0.6',
    };
    const devDependencies = {
      ...pkg.devDependencies,
      tsx: pkg.devDependencies?.tsx ?? pkg.dependencies.tsx ?? '^4.20.6',
    };
    delete devDependencies.openai;
    delete devDependencies['eventsource-parser'];
    await writeFile(
      packagePath,
      `${JSON.stringify({ ...pkg, scripts: { ...pkg.scripts, ...scripts }, dependencies, devDependencies }, null, 2)}\n`
    );
    await writeFile(
      configPath,
      `${JSON.stringify({ ...config, features: { ...config.features, harness: true } }, null, 2)}\n`
    );
    await writeFile(typePath, `${typeSource.trimEnd()}\n${typeExport}\n`);
    await writeFile(
      path.join(root, 'harness/app-harness.json'),
      `${JSON.stringify({ generator: 'app-harness', schemaVersion: 1, profile: 'nextpier', source: identity, files }, null, 2)}\n`
    );
    return { created: true, source: identity };
  } catch (error) {
    await writeFile(packagePath, packageSource);
    await writeFile(configPath, configSource);
    await writeFile(typePath, typeSource);
    for (const target of installed.reverse())
      await rm(target, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
