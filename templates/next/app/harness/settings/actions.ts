'use server';

import { saveHarnessSettings as saveSettings } from '@/app/settings/harness/actions';

export async function saveHarnessSettings(input: unknown) {
  return saveSettings(input);
}
