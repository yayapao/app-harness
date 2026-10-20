import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPortalPrompt,
  parsePortalProposal,
  portalActionFromResult,
  portalSourceSchema,
  promptHandoffSchema,
  validatePortalDesign,
} from '../core';
import type {
  HarnessModel,
  HarnessMessage,
  PortalSource,
  PortalProposal,
  ToolContext,
} from '../core';
import { createResourcePortalSkill } from '../plugins/resource-portal';
import { createMemoryHarnessStore } from '../adapters/memory-store';
import { createBrowserHarnessRuntime } from '../browser/runtime';

const source: PortalSource = {
  id: 'collection_weekly',
  name: '团队周报',
  total: 2,
  entries: [
    { id: 'a', title: '研发周报', description: '摘要', url: 'https://example.com/p/a' },
    { id: 'b', title: '游戏周报', description: '', url: '/p/b', status: 'EXPIRED' },
  ],
};
const design = {
  title: '周报阅览室',
  style: '杂志风',
  grouping: '按主题分类',
  layout: 'list' as const,
  sort: 'updated' as const,
  groups: [{ name: '研发', entryIds: ['a'] }],
};
const proposal: PortalProposal = {
  source,
  requirements: '生成周报门户 Prompt',
  design: validatePortalDesign(design, source),
};
const context = (): ToolContext => ({
  sessionId: 'authorized',
  messageId: 'message',
  abortSignal: new AbortController().signal,
  stream: () => {},
});
const config = { model: 'test', maxIterations: 2, maxTokens: 2048 };

test('portal classification rejects unknown, duplicate and URL-injected model data while preserving omitted entries', () => {
  assert.deepEqual(proposal.design.groups[1], { name: '其他', entryIds: ['b'] });
  for (const groups of [
    [{ name: 'A', entryIds: ['foreign'] }],
    [{ name: 'A', entryIds: ['a', 'a'] }],
    [
      { name: 'A', entryIds: ['a'] },
      { name: 'A', entryIds: ['b'] },
    ],
  ])
    assert.throws(() => validatePortalDesign({ ...design, groups }, source));
  assert.throws(() => validatePortalDesign({ ...design, url: 'https://evil.test' }, source));
  assert.throws(() => portalSourceSchema.parse({ ...source, total: 1 }));
});

test('handoff includes current edits, real links and partial coverage and rejects executable links', () => {
  const changed = {
    ...proposal.design,
    title: '游戏大厅',
    style: '像素风',
    grouping: '按玩法',
    layout: 'cards' as const,
    groups: [{ name: '益智', entryIds: ['b', 'a'] }],
  };
  const prompt = buildPortalPrompt({ ...proposal, source: { ...source, total: 120 } }, changed);
  for (const value of [
    '游戏大厅',
    '像素风',
    '按玩法',
    '卡片网格',
    '2/120',
    '部分内容',
    'PORTAL_CONFIG',
    'PORTAL_ITEMS',
    ...source.entries.map((entry) => entry.url),
  ])
    assert.ok(prompt.includes(value), value);
  for (const url of [
    'javascript:alert(1)',
    '//evil.test',
    '/\\evil.test',
    'https://user:password@example.com',
    'data:text/html,hello',
  ])
    assert.equal(
      promptHandoffSchema.safeParse({
        type: 'prompt_handoff',
        title: '查看',
        prompt: 'Prompt',
        links: [{ label: '入口', href: url }],
      }).success,
      false,
      url,
    );
  assert.ok(
    promptHandoffSchema.safeParse({
      type: 'prompt_handoff',
      title: '查看',
      prompt: 'Prompt',
      links: [{ label: '入口', href: '/settings/harness' }],
    }).success,
  );
});

test('read-only portal plugin loads fresh authorized data and accepts only model design fields', async () => {
  let loaded = 0;
  const model: HarnessModel = {
    async *stream(input) {
      assert.ok(!input.messages[0].content?.includes(source.entries[0].url));
      assert.ok(input.messages[0].content?.includes('研发周报'));
      yield { content: JSON.stringify(proposal.design) };
    },
  };
  const tool = createResourcePortalSkill({
    model,
    loadConfig: async () => config,
    loadSource: async (id, ctx) => {
      assert.equal(id, source.id);
      assert.equal(ctx.sessionId, 'authorized');
      loaded++;
      return source;
    },
  }).tools[0];
  assert.equal(tool.permission, 'read');
  const result = await tool.handler({ sourceId: source.id, requirements: '改成像素风' }, context());
  assert.equal(parsePortalProposal(result).requirements, '改成像素风');
  assert.equal(portalActionFromResult(tool.name, result)?.type, 'portal_design');
  assert.equal(portalActionFromResult('unrelated_tool', result), null);
  await tool.handler({ sourceId: source.id, requirements: '调整分类' }, context());
  assert.equal(loaded, 2);
});

test('availability fallback is explicit and cannot mask authorization, invalid model output or abort', async () => {
  const unavailable: HarnessModel = {
    async *stream() {
      throw new Error('offline');
    },
  };
  const make = (model = unavailable, loadSource = async () => source) =>
    createResourcePortalSkill({
      model,
      loadSource,
      loadConfig: async () => config,
      isModelUnavailable: () => true,
    }).tools[0];
  const input = { sourceId: source.id, requirements: '像素风，使用阅读列表' };
  const fallback = parsePortalProposal(await make().handler(input, context()));
  assert.equal(fallback.fallback, true);
  assert.match(buildPortalPrompt(fallback), /像素风/);
  assert.equal(fallback.design.layout, 'list');
  await assert.rejects(
    make(unavailable, async () => {
      throw new Error('forbidden');
    }).handler(input, context()),
    /forbidden/,
  );
  const invalid: HarnessModel = {
    async *stream() {
      yield {
        content: JSON.stringify({ ...design, groups: [{ name: '偷渡', entryIds: ['foreign'] }] }),
      };
    },
  };
  await assert.rejects(make(invalid).handler(input, context()), /无效或重复/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(make().handler(input, { ...context(), abortSignal: abort.signal }), {
    name: 'AbortError',
  });
});

test('host authorization hides historical actions without mutating stored messages', async () => {
  const store = createMemoryHarnessStore();
  const runtime = createBrowserHarnessRuntime({ store, authorizeMessageAction: async () => null });
  const id = await runtime.createSession();
  const message: HarnessMessage = {
    id: 'message',
    role: 'assistant',
    content: '方案已生成',
    timestamp: Date.now(),
    action: portalActionFromResult('design_resource_portal', proposal)!,
  };
  await store.appendMessage(id, message);
  assert.equal((await runtime.snapshot(id)).messages[0].action, undefined);
  assert.equal((await store.getConversation(id))?.messages[0].action?.type, 'portal_design');
});
