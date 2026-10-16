import assert from 'node:assert/strict';
import test from 'node:test';
import type { HarnessModel } from '../core';
import { createBrowserHarnessRuntime } from '../browser/runtime';
import { createWorkbenchPlugin } from '../plugins/workbench';

test('saved settings reach the next model run and are isolated per browser', async () => {
  const calls: Array<Parameters<HarnessModel['stream']>[0]> = [];
  const model: HarnessModel = {
    async *stream(input) {
      calls.push(input);
      yield { content: '完成' };
    },
  };
  const runtime = createBrowserHarnessRuntime({ mode: 'openai', model });
  const other = createBrowserHarnessRuntime({ mode: 'openai', model });
  runtime.updateSettings({
    model: 'configured-model',
    maxIterations: 3,
    maxTokens: 4096,
  });
  const id = await runtime.createSession();
  for await (const event of runtime.gateway.handleChat(
    id,
    '你好',
    new AbortController().signal
  )) {
    if (event.type === 'error') assert.fail(event.message);
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].config.model, 'configured-model');
  assert.equal(calls[0].config.maxTokens, 4096);
  const snapshot = await runtime.snapshot(id);
  assert.equal(snapshot.settings.maxIterations, 3);
  snapshot.settings.maxTokens = 999;
  assert.equal((await runtime.snapshot(id)).settings.maxTokens, 4096);
  assert.equal((await other.snapshot()).settings.maxTokens, 2048);
});

test('iteration limit is used and settings cannot change during a run', async () => {
  let calls = 0;
  const model: HarnessModel = {
    async *stream() {
      calls++;
      assert.throws(
        () =>
          runtime.updateSettings({
            model: 'changed',
            maxIterations: 8,
            maxTokens: 2048,
          }),
        /停止当前任务/
      );
      yield {
        toolCalls: [
          { index: 0, id: `time-${calls}`, name: 'get_time', arguments: '{}' },
        ],
      };
    },
  };
  const runtime = createBrowserHarnessRuntime({ mode: 'openai', model });
  runtime.updateSettings({
    model: 'loop-model',
    maxIterations: 2,
    maxTokens: 1024,
  });
  const id = await runtime.createSession();
  for await (const event of runtime.gateway.handleChat(
    id,
    '当前时间',
    new AbortController().signal
  )) {
    assert.notEqual(event.type, 'confirmation_request');
  }
  assert.equal(calls, 2);
  assert.equal(runtime.isIdle(), true);
});

test('settings validate bounds and demo model remains fixed', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  assert.throws(() =>
    runtime.updateSettings({ model: 'demo', maxIterations: 0, maxTokens: 2048 })
  );
  assert.throws(() =>
    runtime.updateSettings({
      model: 'demo',
      maxIterations: 33,
      maxTokens: 2048,
    })
  );
  assert.throws(() =>
    runtime.updateSettings({ model: 'demo', maxIterations: 8, maxTokens: 255 })
  );
  assert.throws(
    () =>
      runtime.updateSettings({
        model: 'other-model',
        maxIterations: 8,
        maxTokens: 2048,
      }),
    /演示模式/
  );
  assert.deepEqual(
    runtime.updateSettings({
      model: 'demo',
      maxIterations: 4,
      maxTokens: 4096,
    }),
    { model: 'demo', maxIterations: 4, maxTokens: 4096 }
  );
});

test('capabilities project registered skill relations and effective confirmation rules', async () => {
  const plugin = createWorkbenchPlugin();
  plugin.skills[0].agents = [
    {
      name: 'review_note',
      displayName: '便签复核',
      description: '复核便签内容',
      permission: 'write',
      parameters: { type: 'object', properties: {} },
      outputDescription: '复核结果',
      estimatedDurationMs: 100,
      supportsStreaming: false,
      execute: async () => '完成',
    },
  ];
  plugin.skills.push({
    id: 'empty',
    name: '空能力',
    description: '空能力',
    instructions: '',
    tools: [],
  });
  const runtime = createBrowserHarnessRuntime({
    mode: 'demo',
    plugins: [plugin],
  });
  const { capabilities } = await runtime.snapshot();
  assert.deepEqual(capabilities.skills[0].toolNames, [
    'get_time',
    'list_notes',
    'save_note',
  ]);
  assert.deepEqual(capabilities.skills[0].agentNames, ['review_note']);
  assert.deepEqual(capabilities.skills[0].contextTypes, ['note']);
  assert.deepEqual(capabilities.skills[1].toolNames, []);
  assert.equal(capabilities.agents[0].requiresConfirmation, true);
  assert.equal(
    capabilities.tools.find((tool) => tool.name === 'save_note')
      ?.requiresConfirmation,
    true
  );
  assert.equal(
    capabilities.tools.find((tool) => tool.name === 'get_time')
      ?.requiresConfirmation,
    false
  );
});
