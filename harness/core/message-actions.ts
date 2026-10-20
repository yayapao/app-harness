import { z } from 'zod';
import { safeLinkSchema } from './resource-portal';

export const promptHandoffSchema = z
  .object({
    type: z.literal('prompt_handoff'),
    title: z.string().min(1).max(128),
    prompt: z.string().min(1).max(100_000),
    links: z
      .array(z.object({ label: z.string().min(1).max(80), href: safeLinkSchema }).strict())
      .max(8)
      .optional(),
  })
  .strict();

/** A host client adapter can reuse its built-in ChatGPT button or another target. */
export type PromptTarget = { label: string; open: (prompt: string) => void | Promise<void> };
