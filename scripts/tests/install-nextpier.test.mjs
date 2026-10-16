import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateInstallation } from '../../profiles/nextpier/doctor.mjs';
import { installNextPier as upgradeHarness } from '../lib/install-nextpier.mjs';
import { access } from 'node:fs/promises';
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const repository = fileURLToPath(new URL('../../', import.meta.url));
const template = repository;

async function sourceFixture(t) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'app-harness-source-test-')
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const entry of ['harness', 'templates', 'profiles', 'package.json'])
    await cp(path.join(repository, entry), path.join(root, entry), {
      recursive: true,
    });
  return root;
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nextpier-harness-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'types'));
  await writeFile(path.join(root, 'types', 'index.ts'), '// user types\n');
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'my-app',
      dependencies: { next: '16.2.1', zod: '^4' },
      scripts: { dev: 'next dev --port 3900', 'desktop:build': 'keep-desktop' },
    })
  );
  await writeFile(
    path.join(root, 'nextpier.config.json'),
    JSON.stringify({
      custom: 'keep',
      features: { harness: false, custom: true },
    })
  );
  return root;
}

test('harness upgrade generates UI, SSE, core, plugins and optional dependencies', async (t) => {
  const root = await fixture(t);
  assert.equal((await upgradeHarness(root, template)).created, true);
  for (const file of [
    'app/harness/page.tsx',
    'app/harness/actions.ts',
    'app/harness/settings/page.tsx',
    'app/harness/settings/actions.ts',
    'app/settings/harness/page.tsx',
    'app/settings/harness/actions.ts',
    'app/@harness/(.)harness/page.tsx',
    'app/@harness/default.tsx',
    'app/@harness/page.tsx',
    'app/@harness/[...catchAll]/page.tsx',
    'app/api/harness/chat/route.ts',
    'harness/core/gateway.ts',
    'harness/app-harness.json',
    'harness/plugins/workbench.ts',
    'components/harness/panel.tsx',
    'components/harness/dialog.tsx',
    'components/harness/capability-card.tsx',
    'types/harness.ts',
    '.env.harness.example',
  ])
    assert.ok(await exists(path.join(root, file)), file);
  const pkg = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );
  assert.equal(pkg.scripts.dev, 'next dev --port 3900');
  assert.equal(pkg.scripts['desktop:build'], 'keep-desktop');
  assert.ok(pkg.dependencies.openai);
  assert.ok(pkg.dependencies['eventsource-parser']);
  assert.ok(pkg.devDependencies.tsx);
  const config = JSON.parse(
    await readFile(path.join(root, 'nextpier.config.json'), 'utf8')
  );
  assert.deepEqual(config, {
    custom: 'keep',
    features: { harness: true, custom: true },
  });
  assert.match(
    await readFile(path.join(root, 'types', 'index.ts'), 'utf8'),
    /^\/\/ user types\nexport type/
  );
});

test('harness upgrade is idempotent and preserves edited source', async (t) => {
  const root = await fixture(t);
  await upgradeHarness(root, template);
  const plugin = path.join(root, 'harness', 'plugins', 'workbench.ts');
  await writeFile(plugin, '// user plugin\n');
  const before = await readFile(path.join(root, 'package.json'), 'utf8');
  assert.equal((await upgradeHarness(root, template)).created, false);
  assert.equal(await readFile(plugin, 'utf8'), '// user plugin\n');
  assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), before);
});

test('legacy installations are preserved; malformed and incomplete markers cannot pass', async (t) => {
  const root = await fixture(t);
  await upgradeHarness(root, template);
  const current = path.join(root, 'harness/app-harness.json');
  const legacy = path.join(root, 'harness/nextpier.json');
  const marker = JSON.parse(await readFile(current, 'utf8'));
  assert.equal(marker.source.version, JSON.parse(await readFile(path.join(repository, 'package.json'), 'utf8')).version);
  assert.match(marker.source.contentSha256, /^[a-f0-9]{64}$/);
  assert.ok(marker.files.includes('harness/doctor.mjs'));
  marker.generator = 'nextpier-harness';
  await writeFile(legacy, JSON.stringify(marker));
  await rm(current);
  const before = await readFile(legacy, 'utf8');
  assert.equal((await upgradeHarness(root, template)).created, false);
  assert.equal(await readFile(legacy, 'utf8'), before);
  marker.files.push('../outside');
  await writeFile(legacy, JSON.stringify(marker));
  await assert.rejects(validateInstallation(root), /无效路径/);
  marker.files.pop();
  await writeFile(legacy, JSON.stringify(marker));
  await rm(path.join(root, 'app/harness/page.tsx'));
  await assert.rejects(upgradeHarness(root, template), /集成文件缺失/);
});

test('harness management joins settings without overwriting other settings', async (t) => {
  const root = await fixture(t);
  const system = path.join(root, 'app/settings/system/page.tsx');
  const layout = path.join(root, 'app/settings/layout.tsx');
  await mkdir(path.dirname(system), { recursive: true });
  await writeFile(system, '// custom system settings\n');
  await writeFile(layout, '// custom settings layout\n');
  await upgradeHarness(root, template);
  assert.equal(await readFile(system, 'utf8'), '// custom system settings\n');
  assert.equal(await readFile(layout, 'utf8'), '// custom settings layout\n');
  assert.ok(await exists(path.join(root, 'app/settings/harness/page.tsx')));
});

test('missing settings template rolls back Harness and keeps existing settings', async (t) => {
  const root = await fixture(t);
  const system = path.join(root, 'app/settings/system/page.tsx');
  await mkdir(path.dirname(system), { recursive: true });
  await writeFile(system, '// custom system settings\n');
  const broken = await sourceFixture(t);
  await rm(path.join(broken, 'templates/next/app/settings/harness'), {
    recursive: true,
  });
  const before = await readFile(
    path.join(root, 'nextpier.config.json'),
    'utf8'
  );
  await assert.rejects(upgradeHarness(root, broken), /模板缺少/);
  assert.equal(await exists(path.join(root, 'harness')), false);
  assert.equal(await exists(path.join(root, 'app/harness')), false);
  assert.equal(await readFile(system, 'utf8'), '// custom system settings\n');
  assert.equal(
    await readFile(path.join(root, 'nextpier.config.json'), 'utf8'),
    before
  );
});

test('harness path and script conflicts fail before changing the project', async (t) => {
  for (const relative of [
    'harness',
    'app/harness',
    'app/@harness',
    'app/settings/harness',
    'components/harness',
    'types/harness.ts',
  ]) {
    const root = await fixture(t);
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), 'user file');
    const before = await readFile(path.join(root, 'package.json'), 'utf8');
    await assert.rejects(upgradeHarness(root, template), /拒绝覆盖/);
    assert.equal(
      await readFile(path.join(root, relative), 'utf8'),
      'user file'
    );
    assert.equal(
      await readFile(path.join(root, 'package.json'), 'utf8'),
      before
    );
  }
  const root = await fixture(t);
  const pkg = JSON.parse(
    await readFile(path.join(root, 'package.json'), 'utf8')
  );
  pkg.scripts['harness:doctor'] = 'custom-doctor';
  await writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
  await assert.rejects(upgradeHarness(root, template), /拒绝覆盖/);
  assert.equal(await exists(path.join(root, 'harness')), false);
});

test('an incomplete template rolls back generated files and metadata', async (t) => {
  const root = await fixture(t);
  const broken = await sourceFixture(t);
  await rm(path.join(broken, 'templates/next/components'), { recursive: true });
  const files = ['package.json', 'nextpier.config.json', 'types/index.ts'];
  const before = await Promise.all(
    files.map((file) => readFile(path.join(root, file), 'utf8'))
  );
  await assert.rejects(upgradeHarness(root, broken), /模板缺少/);
  assert.deepEqual(
    await Promise.all(
      files.map((file) => readFile(path.join(root, file), 'utf8'))
    ),
    before
  );
  assert.equal(await exists(path.join(root, 'harness')), false);
  assert.equal(await exists(path.join(root, 'lib/harness')), false);
});

test('harness CLI supports project paths with spaces and skip-install', async (t) => {
  const root = await fixture(t);
  const project = path.join(root, 'project with spaces');
  await mkdir(project);
  for (const file of ['package.json', 'nextpier.config.json', 'types'])
    await cp(path.join(root, file), path.join(project, file), {
      recursive: true,
    });
  const result = spawnSync(
    process.execPath,
    [
      path.join(repository, 'scripts', 'harness.mjs'),
      'install-nextpier',
      '--project',
      project,
      '--skip-install',
    ],
    { encoding: 'utf8', cwd: project }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /已接入 Browser Harness/);
  assert.ok(await exists(path.join(project, 'harness', 'app-harness.json')));
});

test('linked project metadata cannot redirect writes outside the project', async (t) => {
  for (const file of ['package.json', 'nextpier.config.json']) {
    const root = await fixture(t);
    const outside = await fixture(t);
    const external = path.join(outside, file);
    const before = await readFile(external, 'utf8');
    await rm(path.join(root, file));
    await symlink(external, path.join(root, file));
    await assert.rejects(upgradeHarness(root, template), /符号链接/);
    assert.equal(await readFile(external, 'utf8'), before);
    assert.equal(await exists(path.join(root, 'harness')), false);
  }
});
