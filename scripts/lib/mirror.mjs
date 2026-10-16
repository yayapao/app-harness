import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
// Both repositories share these paths. Git history, dependencies and local data are independent.
export const mirrorEntries = [
  '.agents',
  '.github',
  '.gitlab-ci.yml',
  '.gitignore',
  'AGENTS.md',
  'LICENSE',
  'README.md',
  'docs',
  'harness',
  'profiles',
  'templates',
  'scripts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
];

async function inventory(root) {
  const files = new Map();
  async function visit(relative) {
    const file = path.join(root, relative);
    let info;
    try {
      info = await lstat(file);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (info.isSymbolicLink())
      throw new Error(`同步路径不能是符号链接：${relative}`);
    if (info.isDirectory()) {
      for (const name of (await readdir(file)).sort()) {
        if (['node_modules', '.git', '.DS_Store'].includes(name)) continue;
        if (name.startsWith('.env') && name !== '.env.harness.example')
          throw new Error(`同步目录内存在环境文件：${relative}/${name}`);
        await visit(path.posix.join(relative, name));
      }
    } else if (info.isFile()) {
      files.set(relative, {
        hash: createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
        mode: info.mode & 0o777,
      });
    } else throw new Error(`不支持的同步路径：${relative}`);
  }
  for (const entry of mirrorEntries) await visit(entry);
  return files;
}

export async function mirrorRepositories(
  sourceRoot,
  targetRoot,
  { write = false } = {}
) {
  const source = await realpath(sourceRoot);
  const target = await realpath(targetRoot);
  if (
    source === target ||
    source.startsWith(`${target}${path.sep}`) ||
    target.startsWith(`${source}${path.sep}`)
  )
    throw new Error('两个仓库目录必须相互独立');
  for (const root of [source, target]) {
    const gitRoot = (
      await run('git', ['rev-parse', '--show-toplevel'], { cwd: root })
    ).stdout.trim();
    if ((await realpath(gitRoot)) !== root)
      throw new Error('同步目标必须是 Git 仓库根目录');
  }
  const pkg = JSON.parse(
    await readFile(path.join(source, 'package.json'), 'utf8')
  );
  if (pkg.name !== 'app-harness') throw new Error('源仓库不是 app-harness');
  try {
    const targetPkg = JSON.parse(
      await readFile(path.join(target, 'package.json'), 'utf8')
    );
    if (targetPkg.name !== 'app-harness')
      throw new Error('目标仓库不是 app-harness');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const before = await inventory(target);
  const desired = await inventory(source);
  const changed = [...desired.keys()].filter(
    (file) =>
      desired.get(file).hash !== before.get(file)?.hash ||
      desired.get(file).mode !== before.get(file)?.mode
  );
  const removed = [...before.keys()].filter((file) => !desired.has(file));
  if (!write || (!changed.length && !removed.length))
    return { changed, removed, backup: null };
  const backup = await mkdtemp(
    path.join(os.tmpdir(), 'app-harness-mirror-backup-')
  );
  for (const file of [...changed, ...removed]) {
    if (!before.has(file)) continue;
    await mkdir(path.dirname(path.join(backup, file)), { recursive: true });
    await copyFile(path.join(target, file), path.join(backup, file));
  }
  for (const file of changed) {
    await mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await copyFile(path.join(source, file), path.join(target, file));
    await chmod(path.join(target, file), desired.get(file).mode);
  }
  for (const file of removed) await rm(path.join(target, file));
  return { changed, removed, backup };
}
