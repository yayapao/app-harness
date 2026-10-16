import { getBrowserRuntime } from '@/lib/harness/runtime';
import { createChatResponse } from '@/harness/browser/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const owner = await getBrowserRuntime();
  if (!owner) return Response.json({ error: '请先新建对话' }, { status: 401 });
  return createChatResponse(request, owner);
}
