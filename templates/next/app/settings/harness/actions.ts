'use server';

import { revalidatePath } from 'next/cache';
import { harnessSettingsSchema } from '@/harness/browser/settings';
import { getBrowserRuntime } from '@/lib/harness/runtime';

export async function saveHarnessSettings(input: unknown) {
  const parsed = harnessSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { settings: null, error: parsed.error.issues[0].message };
  }
  try {
    const runtime = (await getBrowserRuntime(true))!;
    const settings = runtime.updateSettings(parsed.data);
    revalidatePath('/settings/harness');
    revalidatePath('/harness');
    return { settings, error: '' };
  } catch (error) {
    return {
      settings: null,
      error: error instanceof Error ? error.message : '保存失败',
    };
  }
}
