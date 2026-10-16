import type {
  HarnessStreamEvent,
  HarnessTool,
  HarnessTraceSink,
  ToolContext,
  HarnessToolPolicy,
  HarnessCacheStore,
} from '../types';
import type { HarnessRegistry } from '../registry';
import { HarnessCache } from '../cache';
import { summarizeResult, type PendingToolCall } from './shared';

export type ConfirmHandler = (
  toolName: string,
  params: Record<string, unknown>,
  confirmationId: string,
) => Promise<string>;

export interface ToolExecutionDeps {
  registry: HarnessRegistry;
  cache: HarnessCacheStore | null;
  trace: HarnessTraceSink | undefined;
  emit: (event: HarnessStreamEvent) => void;
  sessionId: string;
  abortSignal: AbortSignal;
  confirmHandler?: ConfirmHandler;
  tool: HarnessTool;
  policy: HarnessToolPolicy;
}

export async function executeToolCall(
  deps: ToolExecutionDeps,
  toolCall: PendingToolCall,
  params: Record<string, unknown>,
): Promise<string> {
  const { registry, cache, trace, emit, sessionId, abortSignal, confirmHandler, tool, policy } = deps;

  if (!await policy.authorize(tool, sessionId)) {
    throw new Error('Tool is not authorized: ' + tool.name);
  }
  const requiresConfirmation = tool.requiresConfirmation || tool.permission !== 'read';
  const cacheScope = policy.cacheScope?.(tool, sessionId) ?? sessionId;
  if (requiresConfirmation && !confirmHandler) {
    throw new Error('Confirmation handler is required: ' + tool.name);
  }

  // Check cache
  if (!requiresConfirmation && tool.permission === 'read' && tool.cacheTtlMs && cache) {
    const cacheKey = HarnessCache.hashKey(cacheScope, toolCall.name, params);
    const cached = await cache.get(cacheKey);
    if (cached !== undefined) {
      trace?.({
        type: 'cache_hit',
        label: '缓存命中 ' + toolCall.name,
        payload: {
          tool: toolCall.name,
          cacheKey,
          ttlMs: tool.cacheTtlMs,
          value: cached,
        },
      });
      emit({
        type: 'tool_call_completed',
        tool: toolCall.name,
        summary: '(cached) ' + summarizeResult(cached),
      });
      return JSON.stringify(cached);
    }
  }

  // Check confirmation requirement
  if (requiresConfirmation && confirmHandler) {
    emit({
      type: 'confirmation_request',
      id: toolCall.id,
      question: '确认执行 ' + toolCall.name + ' ?',
      options: ['确认', '取消'],
      tool: toolCall.name,
      params,
      choice: tool.confirmationChoice,
    });
    trace?.({
      type: 'confirmation_requested',
      label: '请求确认 ' + toolCall.name,
      payload: { tool: toolCall.name, confirmationId: toolCall.id, params },
    });
    const answer = await confirmHandler(toolCall.name, params, toolCall.id);
    const normalizedAnswer = answer.trim().toLowerCase();
    const selectedValue = answer.startsWith('confirm:') ? answer.slice('confirm:'.length) : null;
    if (selectedValue !== null) {
      const choice = tool.confirmationChoice;
      if (!choice || !choice.options.some((option) => option.value === selectedValue)) {
        throw new Error('确认选项无效');
      }
      params = { ...params, [choice.parameter]: selectedValue };
    }
    const confirmed = selectedValue !== null || ['confirm', 'yes', '是', '确认'].includes(normalizedAnswer);
    if (confirmed) {
      trace?.({
        type: 'confirmation_resolved',
        label: '确认通过 ' + toolCall.name,
        payload: { tool: toolCall.name, answer },
      });
    }
    if (!confirmed) {
      trace?.({
        type: 'confirmation_resolved',
        label: '确认被取消 ' + toolCall.name,
        payload: { tool: toolCall.name, answer },
      });
      return JSON.stringify({ cancelled: true, message: '用户取消了此操作' });
    }
  }

  // Emit start event
  if (abortSignal.aborted) throw new DOMException('已停止', 'AbortError');
  emit({
    type: 'tool_call_started',
    tool: toolCall.name,
    params,
  });
  if (registry.getAgent(tool.name)) emit({ type: 'agent_call_started', agent: tool.name, input: params });
  const toolStartedAt = Date.now();
  trace?.({
    type: 'tool_started',
    label: '工具开始 ' + toolCall.name,
    payload: { tool: toolCall.name, params },
  });

  const toolCtx: ToolContext = {
    sessionId,
    messageId: toolCall.id,
    abortSignal,
    stream: (event) => emit(event),
  };

  try {
    const result = await tool.handler(params, toolCtx);

    for (const prefix of tool.invalidates ?? []) {
      await cache?.invalidatePattern(cacheScope + ':' + prefix);
      trace?.({
        type: 'cache_invalidated',
        label: '缓存失效 ' + prefix,
        payload: { tool: toolCall.name, prefix },
      });
    }

    if (!requiresConfirmation && tool.permission === 'read' && tool.cacheTtlMs && cache) {
      const cacheKey = HarnessCache.hashKey(cacheScope, toolCall.name, params);
      trace?.({
        type: 'cache_write',
        label: '缓存写入 ' + toolCall.name,
        payload: {
          tool: toolCall.name,
          cacheKey,
          ttlMs: tool.cacheTtlMs,
          value: result,
        },
      });
      await cache.set(cacheKey, result, tool.cacheTtlMs);
    }

    trace?.({
      type: 'tool_completed',
      label: '工具完成 ' + toolCall.name,
      durationMs: Date.now() - toolStartedAt,
      payload: { tool: toolCall.name, result },
    });

    emit({
      type: 'tool_call_completed',
      tool: toolCall.name,
      summary: summarizeResult(result),
      result,
    });
    if (registry.getAgent(tool.name)) emit({ type: 'agent_call_completed', agent: tool.name, summary: summarizeResult(result) });

    return JSON.stringify(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    trace?.({
      type: 'tool_error',
      label: '工具失败 ' + toolCall.name,
      durationMs: Date.now() - toolStartedAt,
      payload: { tool: toolCall.name, error: errMsg },
    });
    emit({
      type: 'tool_call_completed',
      tool: toolCall.name,
      summary: 'Error: ' + errMsg,
    });
    return JSON.stringify({ error: errMsg });
  }
}
