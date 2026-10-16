'use server';

import { z } from 'zod';
import {
  getBrowserRuntime,
  requireBrowserRuntime,
} from '@/lib/harness/runtime';

export async function createConversation() {
  const runtime = (await getBrowserRuntime(true))!;
  return runtime.snapshot(await runtime.createSession());
}

export async function loadConversation(id: string) {
  return (await requireBrowserRuntime()).snapshot(z.uuid().parse(id));
}

export async function removeConversation(id: string) {
  const runtime = await requireBrowserRuntime();
  await runtime.removeSession(z.uuid().parse(id));
  return runtime.snapshot();
}

export async function confirmTool(
  id: string,
  confirmationId: string,
  answer: string
) {
  const input = z
    .object({
      id: z.uuid(),
      confirmationId: z.string().min(1).max(200),
      answer: z.string().min(1).max(200),
    })
    .parse({ id, confirmationId, answer });
  const runtime = await requireBrowserRuntime();
  if (!runtime.hasSession(input.id)) throw new Error('会话不存在');
  if (
    !runtime.gateway.handleConfirmation(
      input.id,
      input.confirmationId,
      input.answer
    )
  )
    throw new Error('确认请求已过期');
}

export async function stopConversation(id: string) {
  const runtime = await requireBrowserRuntime();
  if (!runtime.hasSession(z.uuid().parse(id))) throw new Error('会话不存在');
  runtime.gateway.stopSession(id);
}
