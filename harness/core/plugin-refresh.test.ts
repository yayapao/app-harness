import test from 'node:test';
import assert from 'node:assert/strict';
import { HarnessGateway } from './gateway';
import { createMemoryHarnessStore } from '../adapters/memory-store';
import type { HarnessPlugin } from './types';

function plugin(result: string): HarnessPlugin {
  return { name: 'sample', version: result, skills: [{
    id: 'sample', name: 'Sample', description: '', instructions: '', tools: [{
      name: 'sample', description: result, category: 'test', permission: 'read',
      parameters: { type: 'object', properties: {} }, handler: async () => result,
    }],
  }] };
}

test('刷新代码工具保留现有会话和正在运行的工具，下一轮读取新注册表', async () => {
  const gateway = new HarnessGateway({
    config: { model: 'fake', maxIterations: 3, maxTokens: 100 },
    plugins: [plugin('old')], store: createMemoryHarnessStore(), policy: { authorize: () => true },
    model: { async *stream({ messages }) {
      const last = messages.at(-1);
      if (last?.role === 'tool') yield { content: JSON.parse(last.content ?? '""') as string };
      else yield { toolCalls: [{ index: 0, id: 'call', name: 'sample', arguments: '{}' }] };
    } },
  });
  const session = await gateway.createSession();
  let output = '';
  for await (const event of gateway.handleChat(session.id, 'first', new AbortController().signal)) {
    if (event.type === 'tool_call_started') HarnessGateway.updatePlugins(gateway, [plugin('new')]);
    if (event.type === 'message_delta') output += event.content;
    assert.notEqual(event.type, 'error');
  }
  assert.equal(output, 'old');
  assert.equal(gateway.getSession(session.id), session);
  assert.equal(gateway.getCapabilities().tools[0].description, 'new');
  output = '';
  for await (const event of gateway.handleChat(session.id, 'second', new AbortController().signal)) {
    if (event.type === 'message_delta') output += event.content;
    assert.notEqual(event.type, 'error');
  }
  assert.equal(output, 'new');
  assert.equal(session.runState, 'idle');
});
