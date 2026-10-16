import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { createBrowserHarnessRuntime } from '@/harness/browser/runtime';

declare global {
  var _appHarnessOwners:
    | Map<
        string,
        {
          runtime: ReturnType<typeof createBrowserHarnessRuntime>;
          touched: number;
        }
      >
    | undefined;
}

const owners = (globalThis._appHarnessOwners ??= new Map());
const cookieName = 'app-harness-owner';

export async function getBrowserRuntime(create = false) {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  const owner = token ? owners.get(token) : undefined;
  if (owner) {
    owner.touched = Date.now();
    return owner.runtime;
  }
  if (!create) return null;
  for (const [key, value] of owners) {
    if (
      Date.now() - value.touched > 24 * 60 * 60 * 1000 &&
      value.runtime.isIdle()
    )
      owners.delete(key);
  }
  if (owners.size >= 50) throw new Error('服务繁忙，请稍后重试');
  const runtime = createBrowserHarnessRuntime();
  const key = randomBytes(32).toString('hex');
  const requestHeaders = await headers();
  jar.set(cookieName, key, {
    httpOnly: true,
    sameSite: 'strict',
    secure: requestHeaders.get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: 86400,
  });
  owners.set(key, { runtime, touched: Date.now() });
  return runtime;
}

export async function requireBrowserRuntime() {
  const runtime = await getBrowserRuntime();
  if (!runtime) throw new Error('会话已失效，请新建对话');
  return runtime;
}
