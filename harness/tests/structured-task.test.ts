import assert from 'node:assert/strict';
import test from 'node:test';
import { runStructuredTask, StructuredTaskError } from '../core/structured-task';
import type { HarnessModel, HarnessModelChunk } from '../core/types';

const input = {
  config: { model: 'test', maxTokens: 1000, maxIterations: 8 },
  task: { name: 'search_intent', description: 'intent', parameters: { type: 'object' as const, properties: {} } },
  instructions: 'Extract intent', prompt: 'yesterday', signal: new AbortController().signal,
  parse: (value: unknown) => {
    assert.deepEqual(value, { period: 'yesterday' }); return value;
  },
};
function model(chunks: HarnessModelChunk[]): HarnessModel {
  return { async *stream(request) {
    assert.equal(request.config.maxIterations, 1);
    assert.equal(request.tools.length, 1);
    for (const chunk of chunks) yield chunk;
  } };
}
test('single structured turn accumulates tool arguments without executing a handler or creating a session', async () => {
  assert.deepEqual(await runStructuredTask({ ...input, model: model([
    { toolCalls: [{ index: 0, name: 'search_intent', arguments: '{"period":' }] },
    { toolCalls: [{ index: 0, arguments: '"yesterday"}' }] },
  ]) }), { period: 'yesterday' });
});
test('compatible JSON content is validated, and foreign calls, multiple calls and oversized output fail', async () => {
  await runStructuredTask({ ...input, model: model([{ content: '```json\n{"period":"yesterday"}\n```' }]) });
  for (const chunks of [
    [{ toolCalls: [{ index: 0, name: 'delete_projects', arguments: '{}' }] }],
    [{ toolCalls: [{ index: 0, name: 'search_intent', arguments: '{}' }, { index: 1, name: 'search_intent', arguments: '{}' }] }],
    [{ content: 'x'.repeat(32769) }], [{ content: '{invalid' }], [],
  ]) await assert.rejects(runStructuredTask({ ...input, model: model(chunks) }), StructuredTaskError);
  await assert.rejects(runStructuredTask({ ...input, model: model([{ content: '{}' }]) }), /deep-equal/);
});
test('cancellation propagates and model errors are not converted into valid search results', async () => {
  const controller = new AbortController();
  const cancelled: HarnessModel = { async *stream() { controller.abort(); yield { content: '{"period":"yesterday"}' }; } };
  await assert.rejects(runStructuredTask({ ...input, model: cancelled, signal: controller.signal }), { name: 'AbortError' });
  const failed: HarnessModel = { async *stream() { throw new Error('upstream unavailable'); } };
  await assert.rejects(runStructuredTask({ ...input, model: failed }), /upstream unavailable/);
});
