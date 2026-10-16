import { setTimeout } from 'node:timers/promises';
import type { HarnessModel } from '../core';

export function createDemoModel(): HarnessModel {
  return {
    async *stream({ messages, signal }) {
      signal.throwIfAborted();
      const last = messages.at(-1);
      if (last?.role === 'tool') {
        const result = JSON.parse(last.content ?? '{}');
        const response = result.cancelled
          ? '已取消保存。'
          : result.error
            ? String(result.error)
            : JSON.stringify(result, null, 2);
        for (const content of response.match(/[\s\S]{1,20}/gu) ?? []) {
          await setTimeout(12, undefined, { signal });
          yield { content };
        }
        return;
      }
      const message = last?.content?.trim() ?? '';
      const note = /^(?:保存便签|保存|记录)[：:\s]+([\s\S]+)$/.exec(message);
      const tool = note
        ? 'save_note'
        : /便签/.test(message)
          ? 'list_notes'
          : /时间/.test(message)
            ? 'get_time'
            : null;
      if (tool) {
        yield {
          toolCalls: [
            {
              index: 0,
              id: crypto.randomUUID(),
              name: tool,
              arguments: JSON.stringify(note ? { content: note[1] } : {}),
            },
          ],
        };
        return;
      }
      const response = `收到：${message}`;
      for (const content of response.match(/[\s\S]{1,20}/gu) ?? []) {
        await setTimeout(12, undefined, { signal });
        yield { content };
      }
    },
  };
}
