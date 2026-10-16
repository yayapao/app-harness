import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiCompatibleModel } from './openai-model';

test('OpenAI adapter maps streamed text and tool call fragments', async () => {
  const events = [
    { id: 'chat-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Hello' } }] },
    { id: 'chat-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'sample', arguments: '{' } }] } }] },
    { id: 'chat-1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '}' } }] } }] },
  ];
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('') + 'data: [DONE]\n\n';
  let requestBody: Record<string, unknown> = {};
  const model = createOpenAiCompatibleModel({
    apiKey: 'test', baseUrl: 'https://example.test/v1',
    fetch: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
    },
  });
  const chunks = [];
  for await (const chunk of model.stream({
    config: { model: 'test', maxIterations: 2, maxTokens: 100 },
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: null, toolCalls: [{ id: 'previous', name: 'sample', arguments: '{}' }] },
      { role: 'tool', content: 'ok', toolCallId: 'previous' },
    ],
    tools: [{ name: 'sample', description: 'Sample', parameters: { type: 'object', properties: {} } }],
    signal: new AbortController().signal,
  })) chunks.push(chunk);
  assert.equal(chunks[0].content, 'Hello');
  assert.equal(chunks[1].toolCalls?.[0].name, 'sample');
  assert.equal(chunks[2].toolCalls?.[0].arguments, '}');
  assert.deepEqual((requestBody.tools as Array<{ function: { name: string } }>)[0].function.name, 'sample');
  assert.equal((requestBody.messages as Array<{ tool_call_id?: string }>)[2].tool_call_id, 'previous');
});
