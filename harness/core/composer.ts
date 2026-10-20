import type { HarnessCapabilities } from './types';

export type ComposerTrigger = {
  kind: 'command' | 'reference';
  start: number;
  end: number;
  query: string;
};
export type ComposerCommand = { id: string; label: string; group: string; prompt: string };
export type ReferenceSuggestion = {
  type: string;
  value: string;
  label: string;
  description?: string;
};
export type ReferenceSearchContext = { sessionId?: string; signal: AbortSignal; limit: number };

// Menus open at token boundaries, never inside an email, URL or file path.
export function composerTrigger(text: string, caret: number): ComposerTrigger | null {
  const match = text.slice(0, caret).match(/(?:^|[\s（(，,。；;])([@/])([^\s@/]{0,80})$/u);
  if (!match) return null;
  const rest = text.slice(caret).match(/^[^\s@/]+/u)?.[0] ?? '';
  return {
    kind: match[1] === '/' ? 'command' : 'reference',
    start: caret - match[2].length - 1,
    end: caret + rest.length,
    query: match[2],
  };
}

export function replaceComposerToken(
  text: string,
  range: Pick<ComposerTrigger, 'start' | 'end'>,
  value: string,
) {
  const suffix = text.slice(range.end);
  const inserted = value && (!suffix || !/^\s/u.test(suffix)) ? `${value} ` : value;
  return {
    text: `${text.slice(0, range.start)}${inserted}${suffix}`,
    caret: range.start + inserted.length,
  };
}

export function insertComposerTrigger(text: string, caret: number, symbol: '@' | '/') {
  const current = composerTrigger(text, caret);
  const start = current?.start ?? caret;
  const prefix = text.slice(0, start);
  const token = prefix && !/[\s（(，,。；;]$/u.test(prefix) ? ` ${symbol}` : symbol;
  const suffix = text.slice(current?.end ?? caret);
  return {
    text: `${prefix}${token}${suffix && !/^\s/u.test(suffix) ? ' ' : ''}${suffix}`,
    caret: start + token.length,
  };
}

export function referenceToken(item: Pick<ReferenceSuggestion, 'type' | 'value'>) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(item.type) || !item.value || item.value.length > 256)
    throw new Error('引用无效');
  return `@${item.type}:${encodeURIComponent(item.value)}`;
}

/** Registry projection only: choosing a command composes text, never invokes a tool. */
export function composerCommands(capabilities: HarnessCapabilities, query = ''): ComposerCommand[] {
  return [
    ...capabilities.skills.map((skill) => ({
      id: `skill:${skill.id}`,
      label: skill.name,
      group: '技能',
      prompt: `请使用“${skill.name}”处理：`,
    })),
    ...capabilities.agents.map((agent) => ({
      id: `agent:${agent.name}`,
      label: agent.displayName,
      group: '助手',
      prompt: `请使用“${agent.displayName}”处理：`,
    })),
  ].filter((item) =>
    `${item.label} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
}
