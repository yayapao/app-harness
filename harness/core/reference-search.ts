import { z } from 'zod';
import type { HarnessRegistry } from './registry';
import type { ReferenceSearchContext, ReferenceSuggestion } from './composer';

const inputSchema = z
  .object({ query: z.string().max(100), type: z.string().max(64).optional() })
  .strict();
const suggestionSchema = z
  .object({
    type: z.string(),
    value: z.string().min(1).max(256),
    label: z.string().min(1).max(256),
    description: z.string().max(512).optional(),
  })
  .strict();

export async function searchReferences(
  registry: HarnessRegistry,
  input: { query: string; type?: string },
  context: ReferenceSearchContext,
): Promise<ReferenceSuggestion[]> {
  const checked = inputSchema.parse(input);
  context.signal.throwIfAborted();
  const limit = Math.max(1, Math.min(20, context.limit));
  const providers = registry
    .getAllContextProviders()
    .filter((provider) => provider.search && (!checked.type || provider.type === checked.type));
  const results = await Promise.all(
    providers.map(async (provider) => {
      const items = await provider.search!(checked.query, { ...context, limit });
      context.signal.throwIfAborted();
      return items.slice(0, limit).map((value) => {
        const item = suggestionSchema.parse(value);
        if (item.type !== provider.type) throw new Error('引用类型不匹配');
        return item;
      });
    }),
  );
  const seen = new Set<string>();
  return results
    .flat()
    .filter((item) => {
      const key = `${item.type}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
