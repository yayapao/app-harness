import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryHarnessStore } from '../adapters/memory-store';
import { HarnessGateway } from './gateway';
import { HarnessCache } from './cache';
import { executeToolCall } from './orchestrator/tool-execution';
import { HarnessRegistry } from './registry';
import type { HarnessModel, HarnessModelTool, HarnessPlugin, HarnessStreamEvent, HarnessTool } from './types';

const config = { model: 'fake', maxIterations: 3, maxTokens: 100 };

function makeTool(permission: HarnessTool['permission'], handler: HarnessTool['handler']): HarnessTool {
  return {
    name: 'sample', description: 'Sample tool', category: 'test',
    parameters: { type: 'object', properties: {} }, permission, handler,
  };
}

function makeGateway(tool: HarnessTool, authorize: () => boolean, inspectTools?: (tools: HarnessModelTool[]) => void) {
  let calls = 0;
  const model: HarnessModel = {
    async *stream({ tools }) {
      inspectTools?.(tools);
      calls++;
      if (calls === 1) {
        yield { toolCalls: [{ index: 0, id: 'call-1', name: 'sample', arguments: '{}' }] };
      } else {
        yield { content: 'Finished' };
      }
    },
  };
  const plugin: HarnessPlugin = {
    name: 'sample', version: '1.0.0',
    skills: [{ id: 'sample', name: 'Sample', description: '', instructions: '', tools: [tool] }],
  };
  return new HarnessGateway({
    config, model, plugins: [plugin], store: createMemoryHarnessStore(),
    policy: { authorize },
  });
}

test('write tool runs only after host authorization and explicit confirmation', async () => {
  let executed = 0;
  const gateway = makeGateway(makeTool('write', async () => { executed++; return { ok: true }; }), () => true);
  const events: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat('', 'Run sample', new AbortController().signal)) {
    events.push(event);
    if (event.type === 'confirmation_request') {
      assert.equal(executed, 0);
      assert.equal(gateway.handleConfirmation(events[0].type === 'session_started' ? events[0].sessionId : '', event.id, '确认'), true);
    }
  }
  assert.equal(executed, 1);
  assert.equal(events.at(-1)?.type, 'done');
});

test('confirmation choice changes only the registered tool parameter', async () => {
  let received: Record<string, unknown> | null = null;
  const tool: HarnessTool = {
    ...makeTool('write', async (params) => { received = params; return { ok: true }; }),
    confirmationChoice: {
      parameter: 'horizon',
      options: [{ value: 'SHORT', label: '短线' }, { value: 'SWING', label: '波段' }],
    },
  };
  const events: HarnessStreamEvent[] = [];
  await executeToolCall({
    registry: new HarnessRegistry(), cache: null, trace: undefined,
    emit: (event) => events.push(event), sessionId: 'a',
    abortSignal: new AbortController().signal, tool,
    policy: { authorize: () => true },
    confirmHandler: async () => 'confirm:SHORT',
  }, { id: 'call-1', name: tool.name, arguments: '{}' }, { stock: '002185.SZ', horizon: 'SWING' });
  assert.deepEqual(received, { stock: '002185.SZ', horizon: 'SHORT' });
  assert.equal(events.find((event) => event.type === 'confirmation_request')?.choice?.parameter, 'horizon');

  received = null;
  await assert.rejects(executeToolCall({
    registry: new HarnessRegistry(), cache: null, trace: undefined, emit: () => {},
    sessionId: 'a', abortSignal: new AbortController().signal, tool,
    policy: { authorize: () => true },
    confirmHandler: async () => 'confirm:INVALID',
  }, { id: 'call-2', name: tool.name, arguments: '{}' }, { stock: '002185.SZ', horizon: 'SWING' }), /确认选项无效/);
  assert.equal(received, null);
});

test('tool result action is streamed and stored with the assistant message', async () => {
  const store = createMemoryHarnessStore();
  const tool = makeTool('read', async () => ({ runId: 'run-1', report: { summary: '原始结论' } }));
  const model: HarnessModel = {
    async *stream({ messages }) {
      if (messages.some((message) => message.role === 'tool')) yield { content: '模型整理的文字' };
      else yield { toolCalls: [{ index: 0, id: 'call-1', name: 'sample', arguments: '{}' }] };
    },
  };
  const gateway = new HarnessGateway({
    config, model, store, policy: { authorize: () => true },
    plugins: [{ name: 'sample', version: '1', skills: [{ id: 'sample', name: 'sample', description: '', instructions: '', tools: [tool] }] }],
    actionFromToolResult: (name, result) => name === 'sample' && result ? { type: 'research_report', publicId: 'run-1' } : null,
  });
  const session = await gateway.createSession();
  const events: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat(session.id, '分析股票', new AbortController().signal)) events.push(event);
  assert.ok(events.some((event) => event.type === 'message_action' && event.action.publicId === 'run-1'));
  assert.equal((await store.getConversation(session.id))?.messages.at(-1)?.action?.publicId, 'run-1');
});

test('tool result action survives a later model failure', async () => {
  const store = createMemoryHarnessStore();
  const tool = makeTool('read', async () => ({ runId: 'run-1', report: { summary: '原始结论' } }));
  const model: HarnessModel = {
    async *stream({ messages }) {
      if (messages.some((message) => message.role === 'tool')) throw new Error('network error');
      yield { toolCalls: [{ index: 0, id: 'call-1', name: 'sample', arguments: '{}' }] };
    },
  };
  const gateway = new HarnessGateway({
    config, model, store, policy: { authorize: () => true },
    plugins: [{ name: 'sample', version: '1', skills: [{ id: 'sample', name: 'sample', description: '', instructions: '', tools: [tool] }] }],
    actionFromToolResult: (name) => name === 'sample' ? { type: 'research_report', publicId: 'run-1' } : null,
  });
  const session = await gateway.createSession();
  const events: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat(session.id, '分析股票', new AbortController().signal)) events.push(event);
  assert.ok(events.some((event) => event.type === 'message_action'));
  assert.ok(events.some((event) => event.type === 'error' && event.message === 'network error'));
  assert.equal((await store.getConversation(session.id))?.messages.at(-1)?.action?.publicId, 'run-1');
});

test('host denial prevents tool execution', async () => {
  let executed = 0;
  let exposedToolCount = -1;
  const gateway = makeGateway(makeTool('read', async () => { executed++; return 'secret'; }),
    () => false, (tools) => { exposedToolCount = tools.length; });
  const events: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat('', 'Read sample', new AbortController().signal)) events.push(event);
  assert.equal(executed, 0);
  assert.equal(exposedToolCount, 0);
  assert.ok(events.some((event) => event.type === 'error' && event.message.includes('not authorized')));
});

test('write tool fails closed without confirmation handler', async () => {
  const tool = makeTool('write', async () => 'written');
  await assert.rejects(executeToolCall({
    registry: new HarnessRegistry(), cache: null, trace: undefined, emit: () => {},
    sessionId: 'a', abortSignal: new AbortController().signal,
    tool, policy: { authorize: () => true },
  }, { id: 'call-1', name: tool.name, arguments: '{}' }, {}), /Confirmation handler is required/);
});

test('read cache is isolated by session', async () => {
  let executed = 0;
  const tool = { ...makeTool('read', async () => ++executed), cacheTtlMs: 60_000 };
  const cache = new HarnessCache();
  for (const sessionId of ['a', 'a', 'b']) {
    await executeToolCall({
      registry: new HarnessRegistry(), cache, trace: undefined, emit: () => {},
      sessionId, abortSignal: new AbortController().signal,
      tool, policy: { authorize: () => true },
    }, { id: 'call-1', name: tool.name, arguments: '{}' }, {});
  }
  assert.equal(executed, 2);
});

test('plugin registration rejects duplicates without partially installing', () => {
  const registry = new HarnessRegistry();
  const tool = makeTool('read', async () => null);
  assert.throws(() => registry.registerPlugin({
    name: 'sample', version: '1.0.0', skills: [
      { id: 'first', name: 'First', description: '', instructions: '', tools: [tool] },
      { id: 'second', name: 'Second', description: '', instructions: '', tools: [tool] },
    ],
  }), /Duplicate callable/);
  assert.equal(registry.getAllSkills().length, 0);
  assert.throws(() => registry.registerSkill({
    id: 'mixed', name: 'Mixed', description: '', instructions: '', tools: [tool, tool],
  }), /Duplicate callable/);
  assert.equal(registry.getAllSkills().length, 0);
});

test('registered agents are callable through the same tool policy', async () => {
  const registry = new HarnessRegistry();
  registry.registerPlugin({
    name: 'agents', version: '1.0.0', skills: [{
      id: 'agents', name: 'Agents', description: '', instructions: '', tools: [],
      agents: [{
        name: 'analyst', displayName: 'Analyst', description: 'Analyze input',
        permission: 'read', parameters: { type: 'object', properties: {} },
        outputDescription: 'Analysis', estimatedDurationMs: 0, supportsStreaming: false,
        execute: async () => 'analysis',
      }],
    }],
  });
  assert.deepEqual(registry.getAllCallableTools().map((tool) => tool.name), ['analyst']);
  const events: HarnessStreamEvent[] = [];
  const result = await executeToolCall({
    registry, cache: null, trace: undefined, emit: (event) => events.push(event),
    sessionId: 'a', abortSignal: new AbortController().signal,
    tool: registry.getTool('analyst')!, policy: { authorize: () => true },
  }, { id: 'call-1', name: 'analyst', arguments: '{}' }, {});
  assert.equal(result, '"analysis"');
  assert.ok(events.some((event) => event.type === 'agent_call_completed'));
});

test('a storage failure releases the session for retry', async () => {
  const store = createMemoryHarnessStore();
  const createRun = store.createRun;
  let fail = true;
  store.createRun = async (log) => {
    if (fail) { fail = false; throw new Error('Storage unavailable'); }
    await createRun(log);
  };
  const model: HarnessModel = { async *stream() { yield { content: 'Recovered' }; } };
  const gateway = new HarnessGateway({
    config, model, store, plugins: [], policy: { authorize: () => true },
  });
  const session = await gateway.createSession();
  const first: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat(session.id, 'First', new AbortController().signal)) first.push(event);
  assert.ok(first.some((event) => event.type === 'error'));
  assert.equal(gateway.getSession(session.id)?.runState, 'idle');
  const second: HarnessStreamEvent[] = [];
  for await (const event of gateway.handleChat(session.id, 'Second', new AbortController().signal)) second.push(event);
  assert.equal(second.at(-1)?.type, 'done');
});

test('each new run reads the latest host configuration', async () => {
  const observed: string[] = [];
  let current = { model: 'first', maxIterations: 3, maxTokens: 100 };
  const model: HarnessModel = {
    async *stream({ config: active }) {
      observed.push(`${active.model}:${active.maxIterations}:${active.maxTokens}`);
      yield { content: 'Done' };
    },
  };
  const gateway = new HarnessGateway({
    config, model, plugins: [], store: createMemoryHarnessStore(),
    policy: { authorize: () => true }, loadConfig: async () => current,
  });
  const session = await gateway.createSession();
  for await (const event of gateway.handleChat(session.id, 'First', new AbortController().signal)) {
    assert.notEqual(event.type, 'error');
  }
  current = { model: 'second', maxIterations: 5, maxTokens: 200 };
  for await (const event of gateway.handleChat(session.id, 'Second', new AbortController().signal)) {
    assert.notEqual(event.type, 'error');
  }
  assert.deepEqual(observed, ['first:3:100', 'second:5:200']);
});
