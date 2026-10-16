import type { MentionMatch } from '../types';
import type { HarnessRegistry } from '../registry';

export function resolveMentions(registry: HarnessRegistry, rawMessage: string, defaultType?: string): MentionMatch[] {
  const matches: MentionMatch[] = [];
  const seen = new Set<string>();
  const regex = /(?:^|\s)@([^\s@]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawMessage)) !== null) {
    const token = match[1];
    const separator = token.indexOf(':');
    const explicitType = separator > 0 ? token.slice(0, separator) : '';
    const provider = explicitType ? registry.getContextProvider(explicitType) : undefined;
    const fallback = !explicitType && defaultType ? registry.getContextProvider(defaultType) : undefined;
    const parsed = (provider ?? fallback)?.parse('@' + token);
    const type = parsed?.type;
    const value = parsed?.value;
    if (!type || !value || seen.has(type + ':' + value)) continue;
    seen.add(type + ':' + value);
    matches.push({ type, value, raw: match[0].trim() });
  }
  return matches;
}

export async function resolveContextBlocks(
  registry: HarnessRegistry,
  mentions: MentionMatch[],
): Promise<string[]> {
  const blocks: string[] = [];
  for (const mention of mentions) {
    const provider = registry.getContextProvider(mention.type);
    if (!provider) continue;
    try {
      const data = await provider.resolve(mention);
      blocks.push('[@' + mention.type + ':' + mention.value + ']');
      blocks.push(provider.format(data));
      blocks.push('');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      blocks.push('[@' + mention.type + ':' + mention.value + '] 解析失败: ' + msg);
    }
  }
  return blocks;
}
