import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const cli = path.join(root, 'scripts/harness.mjs');

async function fixture() {
  const target = await mkdtemp(path.join(os.tmpdir(), 'app-harness-target-'));
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      dependencies: { next: '16.0.0', react: '19.0.0' },
      scripts: { dev: 'next dev' },
    })
  );
  await writeFile(
    path.join(target, 'route.ts'),
    'export async function getReport(input: { id: string }) { return input.id; }\n'
  );
  await mkdir(path.join(target, 'app'));
  await writeFile(path.join(target, 'app/layout.tsx'), 'export default function Layout({ children }: { children: React.ReactNode }) { return children; }\n');
  return target;
}

test('prompt includes the target and all required entry points', async () => {
  const target = await fixture();
  try {
    const { stdout } = await run(process.execPath, [cli, 'prompt', '--project', target]);
    assert.match(stdout, /app-harness Browser Harness/);
    assert.match(stdout, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(stdout, /\/harness/);
    assert.match(stdout, /\/settings\/harness/);
    assert.match(stdout, /业务鉴权/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test('prepare creates a portable manifest and never writes the target', async () => {
  const target = await fixture();
  const output = await mkdtemp(path.join(os.tmpdir(), 'app-harness-output-parent-'));
  const bundle = path.join(output, 'bundle');
  try {
    const { stdout } = await run(process.execPath, [
      cli,
      'prepare',
      '--project',
      target,
      '--output',
      bundle,
    ]);
    assert.match(stdout, /迁移包已生成/);
    const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'));
    const discovery = JSON.parse(await readFile(path.join(bundle, 'discovery.json'), 'utf8'));
    assert.equal(manifest.generator, 'app-harness-integration');
    assert.equal(discovery.strategy, 'next-app-router');
    assert.ok(manifest.files.some((file) => file.path === 'source/harness/core/gateway.ts'));
    assert.ok(manifest.files.some((file) => file.path === 'source/templates/next/app/harness/page.tsx'));
    assert.ok(manifest.files.some((file) => file.path === 'source/templates/next/app/@harness/(.)harness/page.tsx'));
    assert.ok(manifest.files.some((file) => file.path === 'source/templates/next/app/settings/harness/page.tsx'));
    assert.match(await readFile(path.join(bundle, 'INTEGRATE.md'), 'utf8'), /目标项目/);
    assert.deepEqual((await readdir(target)).sort(), ['app', 'package.json', 'route.ts']);
  } finally {
    await rm(target, { recursive: true, force: true });
    await rm(output, { recursive: true, force: true });
  }
});
