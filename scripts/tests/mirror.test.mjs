import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mirrorRepositories } from '../lib/mirror.mjs';

test('mirror check is read only; sync preserves Git and local files, backs up overwritten sources', async (t) => {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'app-harness-mirror-test-')
  );
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const source = path.join(temporary, 'source');
  const target = path.join(temporary, 'target');
  for (const root of [source, target]) {
    await mkdir(root);
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    await writeFile(path.join(root, 'package.json'), '{"name":"app-harness"}');
    await mkdir(path.join(root, 'docs'));
  }
  await writeFile(path.join(source, 'README.md'), 'new');
  await writeFile(path.join(target, 'README.md'), 'old');
  await writeFile(path.join(target, 'docs/obsolete.md'), 'old doc');
  await writeFile(path.join(target, '.env.local'), 'PRIVATE=keep');
  await writeFile(path.join(target, 'unrelated.txt'), 'keep');
  const gitConfig = await readFile(path.join(target, '.git/config'), 'utf8');
  const diff = await mirrorRepositories(source, target);
  assert.deepEqual(diff.changed, ['README.md']);
  assert.deepEqual(diff.removed, ['docs/obsolete.md']);
  assert.equal(await readFile(path.join(target, 'README.md'), 'utf8'), 'old');
  const synced = await mirrorRepositories(source, target, { write: true });
  t.after(() => rm(synced.backup, { recursive: true, force: true }));
  assert.equal(
    await readFile(path.join(synced.backup, 'README.md'), 'utf8'),
    'old'
  );
  assert.equal(
    await readFile(path.join(synced.backup, 'docs/obsolete.md'), 'utf8'),
    'old doc'
  );
  assert.equal(
    await readFile(path.join(target, '.git/config'), 'utf8'),
    gitConfig
  );
  assert.equal(
    await readFile(path.join(target, '.env.local'), 'utf8'),
    'PRIVATE=keep'
  );
  assert.equal(
    await readFile(path.join(target, 'unrelated.txt'), 'utf8'),
    'keep'
  );
  assert.deepEqual(await mirrorRepositories(source, target), {
    changed: [],
    removed: [],
    backup: null,
  });
  await symlink(
    path.join(source, 'README.md'),
    path.join(target, 'docs/link.md')
  );
  await assert.rejects(
    mirrorRepositories(source, target, { write: true }),
    /符号链接/
  );
});
