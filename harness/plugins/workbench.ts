import { z } from 'zod';
import type { HarnessPlugin } from '../core';

export function createWorkbenchPlugin() {
  const notes = new Map<
    string,
    { id: string; content: string; createdAt: string }
  >();
  const plugin: HarnessPlugin = {
    name: 'workbench',
    version: '1.0.0',
    skills: [
      {
        id: 'workbench',
        name: '工作台',
        description: '时间与便签',
        instructions:
          '涉及时间或便签时使用对应工具。保存便签需要用户确认，不声称完成未执行的操作。',
        tools: [
          {
            name: 'get_time',
            description: '获取当前时间',
            category: '工作台',
            permission: 'read',
            parameters: { type: 'object', properties: {} },
            handler: async (input) => {
              z.object({}).strict().parse(input);
              return { time: new Date().toISOString() };
            },
          },
          {
            name: 'list_notes',
            description: '读取当前浏览器的便签',
            category: '工作台',
            permission: 'read',
            parameters: { type: 'object', properties: {} },
            handler: async (input) => {
              z.object({}).strict().parse(input);
              return { notes: [...notes.values()] };
            },
          },
          {
            name: 'save_note',
            description: '保存一条便签',
            category: '工作台',
            permission: 'write',
            parameters: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: '便签内容，最多 2000 字',
                },
              },
              required: ['content'],
            },
            handler: async (input, context) => {
              const { content } = z
                .object({ content: z.string().trim().min(1).max(2000) })
                .strict()
                .parse(input);
              context.abortSignal.throwIfAborted();
              if (notes.size >= 100) throw new Error('便签数量已达上限');
              const note = {
                id: crypto.randomUUID(),
                content,
                createdAt: new Date().toISOString(),
              };
              notes.set(note.id, note);
              return note;
            },
          },
        ],
        contextProviders: [
          {
            type: 'note',
            displayName: '便签',
            description: '通过 @note:ID 引用便签',
            parse: (raw) => {
              const value = /^@note:([a-f0-9-]+)$/i.exec(raw)?.[1];
              return value ? { type: 'note', value, raw } : null;
            },
            resolve: async (match) => {
              const note = notes.get(match.value);
              if (!note) throw new Error('便签不存在');
              return note;
            },
            format: (note) => JSON.stringify(note),
          },
        ],
      },
    ],
  };
  return plugin;
}
