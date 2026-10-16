import { createBrowserHarnessRuntime } from '@/harness/browser/runtime';
import { getBrowserRuntime } from './runtime';
import type { HarnessSettingsData } from '@/types';

export async function getHarnessInitialData() {
  const runtime = (await getBrowserRuntime()) ?? createBrowserHarnessRuntime();
  const data = await runtime.snapshot();
  return data.sessions.length ? runtime.snapshot(data.sessions[0].id) : data;
}

export async function getHarnessSettingsData(): Promise<HarnessSettingsData> {
  const runtime = (await getBrowserRuntime()) ?? createBrowserHarnessRuntime();
  const { mode, settings, capabilities } = await runtime.snapshot();
  return { mode, settings, capabilities };
}
