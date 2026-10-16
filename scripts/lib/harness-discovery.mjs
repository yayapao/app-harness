import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  discoverOpenApi,
  discoverSymbols,
  hasTypescriptParser,
} from './harness-symbols.mjs';

const ignored = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'coverage',
  '__pycache__',
  'data',
  'uploads',
  'logs',
  'target',
  'generated',
  'test',
  'tests',
  '__tests__',
]);
const sourcePattern = /\.(?:[cm]?[jt]sx?|py|go|java|cs|php|rb|vue|svelte)$/;
const manifestNames = new Set([
  'package.json',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'pom.xml',
  'composer.json',
  'Gemfile',
  'Cargo.toml',
]);
const isSpec = (file) =>
  /(?:^|\/)(?:openapi|swagger)(?:[.-][^/]*)?\.json$/i.test(file);

export async function discoverHarnessProject(directory, options = {}) {
  const root = await realpath(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error('目标项目必须是目录');
  const maxFiles = options.maxFiles ?? 5000;
  const maxFileBytes = options.maxFileBytes ?? 262144;
  const files = [];
  const warnings = [];
  let visited = 0;
  let truncated = false;
  async function walk(relative = '') {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), {
        withFileTypes: true,
      });
    } catch {
      warnings.push({ file: relative || '.', reason: 'read-directory-failed' });
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || ignored.has(entry.name)) continue;
      if (++visited > maxFiles) {
        truncated = true;
        return;
      }
      const next = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) {
        warnings.push({ file: next, reason: 'symlink-skipped' });
        continue;
      }
      if (entry.isDirectory()) {
        await walk(next);
        if (truncated) return;
      } else if (
        entry.isFile() &&
        (sourcePattern.test(next) ||
          manifestNames.has(entry.name) ||
          isSpec(next) ||
          entry.name === 'AGENTS.md')
      ) {
        files.push(next);
      }
    }
  }
  await walk();
  const packages = [];
  const candidates = [];
  for (const file of files) {
    let info;
    try {
      info = await lstat(path.join(root, file));
    } catch {
      warnings.push({ file, reason: 'stat-failed' });
      continue;
    }
    if (info.isSymbolicLink()) {
      warnings.push({ file, reason: 'symlink-skipped' });
      continue;
    }
    if (!info.isFile() || info.size > maxFileBytes) {
      warnings.push({ file, reason: 'file-unavailable-or-too-large' });
      continue;
    }
    if (
      !file.endsWith('package.json') &&
      !isSpec(file) &&
      !/\.[cm]?[jt]sx?$/.test(file)
    )
      continue;
    if (
      /\.(?:test|spec|d)\.[cm]?[jt]sx?$/.test(file) ||
      /(?:^|\/)(?:components|ui)(?:\/|$)/.test(file)
    )
      continue;
    let source;
    try {
      source = await readFile(path.join(root, file), 'utf8');
    } catch {
      warnings.push({ file, reason: 'read-failed' });
      continue;
    }
    if (file.endsWith('package.json') || isSpec(file)) {
      try {
        const data = JSON.parse(source);
        if (file.endsWith('package.json'))
          packages.push({
            file,
            dependencies: Object.keys({
              ...data.dependencies,
              ...data.devDependencies,
            }).sort(),
            scripts: Object.keys(data.scripts ?? {}).sort(),
            packageManager:
              typeof data.packageManager === 'string'
                ? data.packageManager.split('@')[0]
                : undefined,
          });
        else candidates.push(...discoverOpenApi(file, data));
      } catch {
        warnings.push({ file, reason: 'invalid-json' });
      }
    } else candidates.push(...discoverSymbols(file, source));
  }
  const dependencies = new Set(packages.flatMap((pkg) => pkg.dependencies));
  const nextApp =
    dependencies.has('next') &&
    files.some((file) => /(?:^|\/)app\/layout\.[jt]sx?$/.test(file));
  const react = dependencies.has('react');
  const node = packages.length > 0;
  const manifests = files.filter((file) =>
    manifestNames.has(path.posix.basename(file))
  );
  return {
    schemaVersion: 1,
    project: root,
    strategy: nextApp
      ? 'next-app-router'
      : react
        ? 'react-host-adapter'
        : node
          ? 'node-host-adapter'
          : 'service-host-adapter',
    packages,
    manifests,
    instructionFiles: files.filter(
      (file) => path.posix.basename(file) === 'AGENTS.md'
    ),
    sourceFiles: files.filter((file) => sourcePattern.test(file)),
    candidates,
    discovery: {
      typescriptParser: hasTypescriptParser ? 'available' : 'unavailable',
      maxFiles,
      maxFileBytes,
      visited,
      truncated,
      warnings,
      requiresAgentReview: true,
    },
  };
}
