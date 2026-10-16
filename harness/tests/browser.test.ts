import assert from 'node:assert/strict';
import test from 'node:test';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { createBrowserHarnessRuntime } from '../browser/runtime';
import { createChatResponse } from '../browser/transport';
import type { HarnessStreamEvent } from '../core';

function request(
  sessionId: string,
  message: string,
  origin = 'http://app-harness.test',
  signal?: AbortSignal
) {
  return new Request('http://app-harness.test/api/harness/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
    signal,
  });
}

async function collect(
  response: Response,
  onEvent?: (event: HarnessStreamEvent) => void
) {
  assert.equal(response.status, 200);
  const reader = response
    .body!.pipeThrough(new TextDecoderStream())
    .pipeThrough(new EventSourceParserStream())
    .getReader();
  const events: HarnessStreamEvent[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const event = JSON.parse(value.data) as HarnessStreamEvent;
      events.push(event);
      onEvent?.(event);
    }
  } finally {
    reader.releaseLock();
  }
  return events;
}

test('SSE demo confirms a write, streams a result and records the run', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  let confirmed = false;
  const events = await collect(
    await createChatResponse(request(id, '保存便签：测试内容'), runtime),
    (event) => {
      if (event.type === 'confirmation_request') {
        assert.equal(
          runtime.gateway.getSession(id)?.runState,
          'awaiting_confirmation'
        );
        confirmed = runtime.gateway.handleConfirmation(id, event.id, '确认');
      }
    }
  );
  assert.ok(confirmed);
  assert.ok(
    events.some(
      (event) =>
        event.type === 'tool_call_completed' && event.tool === 'save_note'
    )
  );
  assert.equal(events.at(-1)?.type, 'done');
  const snapshot = await runtime.snapshot(id);
  assert.equal(snapshot.messages.length, 2);
  assert.match(snapshot.messages[1].content, /测试内容/);
  assert.equal(snapshot.logs[0].status, 'completed');
  assert.ok(
    snapshot.logs[0].trace?.every((entry) => entry.payload === undefined)
  );
});

test('cancelled confirmation does not save a note', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  await collect(
    await createChatResponse(request(id, '保存便签：不应保存'), runtime),
    (event) => {
      if (event.type === 'confirmation_request')
        runtime.gateway.handleConfirmation(id, event.id, '取消');
    }
  );
  await collect(await createChatResponse(request(id, '列出便签'), runtime));
  assert.match(
    (await runtime.snapshot(id)).messages.at(-1)!.content,
    /"notes": \[\]/
  );
});

test('foreign browser sessions and cross-origin requests are rejected', async () => {
  const first = createBrowserHarnessRuntime({ mode: 'demo' });
  const second = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await first.createSession();
  assert.equal(
    (await createChatResponse(request(id, '当前时间'), second)).status,
    404
  );
  assert.equal(
    (
      await createChatResponse(
        request(id, '当前时间', 'http://foreign.test'),
        first
      )
    ).status,
    403
  );
  await assert.rejects(second.snapshot(id), /不属于当前浏览器/);
  assert.equal(first.gateway.getSession(id)?.messages.length, 0);
});

test('stopping while awaiting confirmation releases the session without executing the write', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  const events = await collect(
    await createChatResponse(request(id, '保存便签：停止测试'), runtime),
    (event) => {
      if (event.type === 'confirmation_request')
        runtime.gateway.stopSession(id);
    }
  );
  assert.ok(
    events.some((event) => event.type === 'error' && event.message === '已停止')
  );
  assert.ok(!events.some((event) => event.type === 'tool_call_started'));
  assert.equal(runtime.gateway.getSession(id)?.runState, 'idle');
  assert.equal((await runtime.snapshot(id)).logs[0].status, 'stopped');
});

test('deleting an idle session removes its messages and run logs', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  await collect(await createChatResponse(request(id, '当前时间'), runtime));
  await runtime.removeSession(id);
  const snapshot = await runtime.snapshot();
  assert.equal(snapshot.sessions.length, 0);
  assert.equal(snapshot.logs.length, 0);
  assert.equal(runtime.hasSession(id), false);
});

test('aborting the chat request releases a pending confirmation without writing', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  const abort = new AbortController();
  const events = await collect(
    await createChatResponse(
      request(id, '保存便签：关闭弹窗', 'http://app-harness.test', abort.signal),
      runtime
    ),
    (event) => {
      if (event.type === 'confirmation_request') abort.abort();
    }
  );
  assert.ok(events.some((event) => event.type === 'confirmation_request'));
  assert.ok(!events.some((event) => event.type === 'tool_call_started'));
  assert.equal(runtime.gateway.getSession(id)?.runState, 'idle');
  assert.equal((await runtime.snapshot(id)).logs[0].status, 'stopped');
  await collect(await createChatResponse(request(id, '列出便签'), runtime));
  assert.match(
    (await runtime.snapshot(id)).messages.at(-1)!.content,
    /"notes": \[\]/
  );
});

test('already aborted requests and invalid messages never execute tools', async () => {
  const runtime = createBrowserHarnessRuntime({ mode: 'demo' });
  const id = await runtime.createSession();
  assert.equal(
    (await createChatResponse(request(id, ''), runtime)).status,
    400
  );
  const abort = new AbortController();
  abort.abort();
  await collect(
    await createChatResponse(
      request(id, '当前时间', 'http://app-harness.test', abort.signal),
      runtime
    )
  );
  assert.equal(runtime.gateway.getSession(id)?.messages.length, 0);
  assert.equal(runtime.gateway.getSession(id)?.runState, 'idle');
});
