import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, realpath, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  harnessSourceEntries,
  prepareHarnessIntegration,
} from '../lib/prepare.mjs';
import {
  file,
  fixture,
  inventory,
  repository,
} from './harness-integration-fixtures.mjs';

test('preparing a kit exports complete references, hashes and a handoff without modifying the target', async (t) => {
  const { temporary, project } = await fixture(t);
  await file(project, 'package.json', '{"dependencies":{"react":"^19"}}');
  await file(
    project,
    'lib/service.ts',
    'export async function readAccount(id: string) { return id; }'
  );
  await file(project, '.env.local', 'SECRET=target-private-value');
  await file(project, 'AGENTS.md', 'Keep current architecture.');
  const before = await inventory(project);
  const output = path.join(temporary, 'portable kit');
  const result = await prepareHarnessIntegration(project, repository, {
    output,
  });
  assert.equal(result.candidateCount, 1);
  const manifest = JSON.parse(
    await readFile(path.join(output, 'manifest.json'), 'utf8')
  );
  for (const entry of manifest.files) {
    const content = await readFile(path.join(output, entry.path));
    assert.equal(
      createHash('sha256').update(content).digest('hex'),
      entry.sha256
    );
    assert.doesNotMatch(content.toString(), /target-private-value/);
  }
  for (const expected of [
    'source/harness/core/gateway.ts',
    'source/templates/next/components/harness/dialog.tsx',
    'source/templates/next/app/settings/harness/page.tsx',
    'source/templates/next/components/ui/halo-tabs.tsx',
    'source/.agents/skills/harness-integrator/references/capabilities.md',
    'source/templates/next/components/ui/cult-ui.LICENSE',
  ])
    assert.ok(
      manifest.files.some((entry) => entry.path === expected),
      expected
    );
  assert.match(
    await readFile(path.join(output, 'INTEGRATE.md'), 'utf8'),
    /基础 Agent/
  );
  assert.equal(manifest.project, await realpath(project));
  assert.deepEqual(await inventory(project), before);
});

test('kits work without repository docs and never export them when present', async (t) => {
  const { temporary, project } = await fixture(t);
  const source = path.join(temporary, 'public source');
  for (const entry of harnessSourceEntries) {
    await mkdir(path.dirname(path.join(source, entry)), { recursive: true });
    await cp(path.join(repository, entry), path.join(source, entry), {
      recursive: true,
    });
  }
  for (const includeNotes of [false, true]) {
    if (includeNotes) {
      await file(source, 'docs/architecture.md', 'Internal architecture notes');
      await file(source, 'docs/integration-prompt.md', 'Old integration prompt');
    }
    const result = await prepareHarnessIntegration(project, source, {
      output: path.join(temporary, includeNotes ? 'internal kit' : 'public kit'),
    });
    const manifest = JSON.parse(
      await readFile(path.join(result.output, 'manifest.json'), 'utf8')
    );
    assert.ok(await readFile(path.join(result.output, manifest.entrypoint)));
    assert.equal(
      manifest.documentation,
      'https://github.com/yayapao/aiwiki/tree/main/app-harness'
    );
    assert.equal(
      manifest.files.some((entry) => entry.path.startsWith('source/docs/')),
      false
    );
    await assert.rejects(
      realpath(path.join(result.output, 'source/docs')),
      /ENOENT/
    );
  }
});

test('output overlap and existing destinations preserve both projects and existing output', async (t) => {
  const { temporary, project } = await fixture(t);
  await file(project, 'service.ts', 'export function readValue() {}');
  const before = await inventory(project);
  await assert.rejects(
    prepareHarnessIntegration(project, repository, {
      output: path.join(project, 'kit'),
    }),
    /之外/
  );
  await assert.rejects(
    prepareHarnessIntegration(project, repository, { output: temporary }),
    /之外/
  );
  await assert.rejects(
    prepareHarnessIntegration(project, repository, { output: repository }),
    /之外/
  );
  const output = path.join(temporary, 'existing kit');
  await file(output, 'user.txt', 'keep user output');
  await assert.rejects(
    prepareHarnessIntegration(project, repository, { output }),
    /EEXIST/
  );
  assert.equal(
    await readFile(path.join(output, 'user.txt'), 'utf8'),
    'keep user output'
  );
  assert.deepEqual(await inventory(project), before);
});

test('a malformed source removes its partial kit and never changes the target', async (t) => {
  const { temporary, project } = await fixture(t);
  const source = path.join(temporary, 'broken source');
  for (const entry of harnessSourceEntries) {
    await mkdir(path.dirname(path.join(source, entry)), { recursive: true });
    await cp(path.join(repository, entry), path.join(source, entry), {
      recursive: true,
    });
  }
  await file(source, 'package.json', '{"dependencies":null}');
  const output = path.join(temporary, 'failed kit');
  await assert.rejects(prepareHarnessIntegration(project, source, { output }));
  await assert.rejects(realpath(output), /ENOENT/);
  assert.deepEqual(await inventory(project), {});
  await rm(path.join(source, 'templates/next/lib/utils.ts'));
  await symlink(
    path.join(repository, 'templates/next/lib/utils.ts'),
    path.join(source, 'templates/next/lib/utils.ts')
  );
  await assert.rejects(
    prepareHarnessIntegration(project, source, { output }),
    /源文件/
  );
});

test('prepare CLI runs from another working directory with spaces and no target NextPier config', async (t) => {
  const { temporary, project } = await fixture(t);
  await file(project, 'pyproject.toml', '[project]\nname="existing-service"');
  const output = path.join(temporary, 'cli kit');
  const result = spawnSync(
    process.execPath,
    [
      path.join(repository, 'scripts/harness.mjs'),
      'prepare',
      '--project',
      project,
      '--output',
      output,
    ],
    { cwd: temporary, encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /目标项目未修改/);
  assert.ok(await readFile(path.join(output, 'discovery.json'), 'utf8'));
  const invalid = spawnSync(
    process.execPath,
    [path.join(repository, 'scripts/harness.mjs'), 'prepare'],
    { cwd: temporary, encoding: 'utf8' }
  );
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /--project/);
});

test('default output refuses a temporary directory inside the target', async (t) => {
  const { temporary, project } = await fixture(t);
  const before = await inventory(project);
  const result = spawnSync(
    process.execPath,
    [
      path.join(repository, 'scripts/harness.mjs'),
      'prepare',
      '--project',
      project,
    ],
    {
      cwd: temporary,
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: project, TMP: project, TEMP: project },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--output/);
  assert.deepEqual(await inventory(project), before);
});

test('a source checkout without installed dependencies can prepare a portable kit', async (t) => {
  const { temporary, project } = await fixture(t);
  const source = path.join(temporary, 'source without dependencies');
  for (const entry of [...harnessSourceEntries, 'package.json', 'scripts']) {
    await mkdir(path.dirname(path.join(source, entry)), { recursive: true });
    await cp(path.join(repository, entry), path.join(source, entry), {
      recursive: true,
    });
  }
  await file(project, 'service.ts', 'export function readTicket() {}');
  await file(
    project,
    'openapi.json',
    JSON.stringify({
      paths: {
        '/tickets': { get: { operationId: 'listTickets' } },
      },
    })
  );
  const output = path.join(temporary, 'kit without dependencies');
  const result = spawnSync(
    process.execPath,
    [
      path.join(source, 'scripts/harness.mjs'),
      'prepare',
      '--project',
      project,
      '--output',
      output,
    ],
    {
      cwd: temporary,
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(realpath(path.join(source, 'node_modules')), /ENOENT/);
  const report = JSON.parse(
    await readFile(path.join(output, 'discovery.json'), 'utf8')
  );
  assert.ok(report.sourceFiles.includes('service.ts'));
  assert.ok(report.candidates.some((item) => item.name === 'listTickets'));
  if (report.discovery.typescriptParser === 'unavailable')
    assert.deepEqual(
      report.candidates.map((item) => item.name),
      ['listTickets']
    );
  const skill = await readFile(
    path.join(output, 'source/.agents/skills/harness-integrator/SKILL.md'),
    'utf8'
  );
  assert.match(skill, /不要再次准备/);
  assert.match(skill, /manifest.source/);
});
