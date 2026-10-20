import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HarnessRegistry,
  composerCommands,
  composerTrigger,
  insertComposerTrigger,
  referenceToken,
  replaceComposerToken,
} from '../core';
import { resolveMentions, resolveContextBlocks } from '../core/gateway/mentions';
import { createBrowserHarnessRuntime } from '../browser/runtime';
import type { HarnessPlugin } from '../core';

function plugin(): HarnessPlugin {
  return {
    name: 'test',
    version: '1',
    skills: [
      {
        id: 'reports',
        name: '周报分析',
        description: '分析已授权周报',
        instructions: '',
        tools: [],
        contextProviders: [
          {
            type: 'collection',
            displayName: '收藏夹',
            description: '当前用户收藏夹',
            parse: (raw) =>
              raw.startsWith('@collection:')
                ? { type: 'collection', value: raw.slice(12), raw }
                : null,
            resolve: async (match) => {
              assert.equal(match.value, '周报 team');
              return { title: '周报' };
            },
            format: (data) => String(data.title),
            search: async (query, context) => {
              context.signal.throwIfAborted();
              assert.equal(query, '周报');
              assert.ok(context.limit <= 20);
              return [{ type: 'collection', value: '周报 team', label: '团队周报' }];
            },
          },
        ],
      },
    ],
  };
}

test('slash and reference lookup preserve surrounding text and ignore emails, URLs and paths', () => {
  assert.equal(composerTrigger('/分析', 3)?.kind, 'command');
  assert.equal(composerTrigger('帮我 @周报', 6)?.kind, 'reference');
  for (const text of ['a@b.com', 'https://host/a', '/Users/me/app', '完成 /分析 结束'])
    assert.equal(composerTrigger(text, text.length), null);
  const draft = '请 /分析 并总结';
  const range = composerTrigger(draft, 4)!;
  assert.equal(replaceComposerToken(draft, range, '查看周报').text, '请 查看周报 并总结');
  const next = insertComposerTrigger('请总结', 3, '@');
  assert.equal(next.text, '请总结 @');
  assert.equal(composerTrigger(next.text, next.caret)?.kind, 'reference');
});

test('commands come from registered skills and never invoke their tools', () => {
  const registry = new HarnessRegistry();
  registry.registerPlugin(plugin());
  assert.deepEqual(composerCommands(registry.getCapabilities(), '周报'), [
    { id: 'skill:reports', label: '周报分析', group: '技能', prompt: '请使用“周报分析”处理：' },
  ]);
  assert.equal(composerCommands(registry.getCapabilities(), '不存在').length, 0);
});

test('selected references safely round-trip spaces and unicode through server resolution', async () => {
  const registry = new HarnessRegistry();
  registry.registerPlugin(plugin());
  const token = referenceToken({ type: 'collection', value: '周报 team' });
  const matches = resolveMentions(registry, `${token} ${token} 设计门户`);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].value, '周报 team');
  assert.deepEqual(await resolveContextBlocks(registry, matches), [
    '[@collection:周报 team]',
    '周报',
    '',
  ]);
  assert.deepEqual(resolveMentions(registry, '@collection:%XY'), []);
  assert.throws(() => referenceToken({ type: 'foreign:type', value: 'a' }));
});

test('candidate search rejects foreign sessions, supports provider filtering and honors cancellation', async () => {
  const runtime = createBrowserHarnessRuntime({ plugins: [plugin()] });
  const id = await runtime.createSession();
  assert.equal(
    (await runtime.searchReferences({ query: '周报', sessionId: id }))[0].label,
    '团队周报',
  );
  assert.deepEqual(
    await runtime.searchReferences({ query: '周报', type: 'missing', sessionId: id }),
    [],
  );
  assert.throws(
    () => runtime.searchReferences({ query: '周报', sessionId: crypto.randomUUID() }),
    /不属于当前浏览器/,
  );
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(runtime.searchReferences({ query: '周报' }, abort.signal), {
    name: 'AbortError',
  });
  assert.equal(
    runtime.gateway.getSession(id)?.messages.length,
    0,
    'lookup does not send a chat or run a tool',
  );
});
