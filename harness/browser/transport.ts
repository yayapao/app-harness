import { z } from 'zod';
import type { createBrowserHarnessRuntime } from './runtime';

const chatSchema = z
  .object({
    sessionId: z.uuid(),
    message: z.string().trim().min(1).max(6000),
    rewindTo: z.number().int().min(0).optional(),
  })
  .strict();

export async function createChatResponse(
  request: Request,
  runtime: ReturnType<typeof createBrowserHarnessRuntime>
) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: '请求来源无效' }, { status: 403 });
  let body;
  try {
    const text = await request.text();
    if (text.length > 24000)
      return Response.json({ error: '消息过长' }, { status: 413 });
    body = chatSchema.safeParse(JSON.parse(text));
  } catch {
    return Response.json({ error: '请求格式无效' }, { status: 400 });
  }
  if (!body.success)
    return Response.json({ error: '请提供有效的会话与消息' }, { status: 400 });
  const { sessionId, message, rewindTo } = body.data;
  if (!runtime.hasSession(sessionId))
    return Response.json({ error: '会话不存在' }, { status: 404 });
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (request.signal.aborted) cancel();
  else request.signal.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 120000);
  timer.unref?.();
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runtime.gateway.handleChat(
          sessionId,
          message,
          abort.signal,
          rewindTo
        )) {
          if (!closed)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
        }
      } catch {
        if (!closed)
          controller.enqueue(
            encoder.encode(
              'data: {"type":"error","message":"对话运行失败","recoverable":false}\n\n'
            )
          );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', cancel);
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
      cancel();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
