import OpenAI from 'openai';
import type { HarnessModel, HarnessModelMessage } from '../core/types';

function toOpenAiMessage(message: HarnessModelMessage): OpenAI.ChatCompletionMessageParam {
  if (message.role === 'tool') {
    if (!message.toolCallId) throw new Error('Tool message requires a tool call ID');
    return { role: 'tool', content: message.content ?? '', tool_call_id: message.toolCallId };
  }
  if (message.role === 'assistant') {
    return {
      role: 'assistant', content: message.content,
      tool_calls: message.toolCalls?.map((call) => ({
        id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role, content: message.content ?? '' };
}

export function createOpenAiCompatibleModel(options: { apiKey: string; baseUrl?: string; fetch?: typeof fetch }): HarnessModel {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseUrl, fetch: options.fetch });
  return {
    async *stream({ config, messages, tools, signal }) {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: messages.map(toOpenAiMessage),
        tools: tools.map((tool) => ({ type: 'function' as const, function: tool })),
        stream: true,
        max_tokens: config.maxTokens,
      }, { signal });

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        yield {
          content: delta.content ?? undefined,
          toolCalls: delta.tool_calls?.map((call) => ({
            index: call.index,
            id: call.id,
            name: call.function?.name,
            arguments: call.function?.arguments,
          })),
        };
      }
    },
  };
}
