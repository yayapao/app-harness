import type {
  HarnessStreamEvent,
  OrchestratorConfig,
  HarnessTraceSink,
  ModelToolMetadata,
  HarnessToolPolicy,
  HarnessModel,
  HarnessModelMessage,
  HarnessModelTool,
  HarnessCacheStore,
} from './types';
import type { HarnessRegistry } from './registry';
import { buildModelToolDefinitions, buildSystemPrompt, type PendingToolCall } from './orchestrator/shared';
import { executeToolCall, type ConfirmHandler } from './orchestrator/tool-execution';

export { buildModelToolDefinitions } from './orchestrator/shared';

type EventCallback = (event: HarnessStreamEvent) => void;

export class HarnessOrchestrator {
  private model: HarnessModel;
  private config: OrchestratorConfig;
  private registry: HarnessRegistry;
  private cache: HarnessCacheStore | null;
  private eventCallback: EventCallback;
  private trace: HarnessTraceSink | undefined;
  private policy: HarnessToolPolicy;
  private systemInstructions: string;

  constructor(
    config: OrchestratorConfig,
    registry: HarnessRegistry,
    cache: HarnessCacheStore | null,
    eventCallback: EventCallback,
    trace?: HarnessTraceSink,
    policy?: HarnessToolPolicy,
    systemInstructions = '',
    model?: HarnessModel,
  ) {
    this.config = config;
    this.registry = registry;
    this.cache = cache;
    this.eventCallback = eventCallback;
    this.trace = trace;
    this.policy = policy ?? { authorize: () => false };
    this.systemInstructions = systemInstructions;
    if (!model) throw new Error('A model adapter is required');
    this.model = model;
  }

  private emit(event: HarnessStreamEvent): void {
    this.eventCallback(event);
  }

  private async buildTools(metadata: Record<string, ModelToolMetadata>, sessionId: string): Promise<HarnessModelTool[]> {
    const tools = this.registry.getAllCallableTools();
    const allowed = await Promise.all(tools.map((tool) => this.policy.authorize(tool, sessionId)));
    return buildModelToolDefinitions(tools.filter((_, index) => allowed[index]), metadata);
  }

  private buildSystemPrompt(contextBlocks: string[]): string {
    return buildSystemPrompt(this.registry, contextBlocks, this.systemInstructions);
  }

  async *run(
    messages: HarnessModelMessage[],
    contextBlocks: string[],
    sessionId: string,
    abortSignal: AbortSignal,
    confirmHandler?: ConfirmHandler,
    toolMetadata: Record<string, ModelToolMetadata> = {},
  ): AsyncGenerator<string> {
    const systemPrompt = this.buildSystemPrompt(contextBlocks);
    if (this.config.maxIterations < 1) throw new Error('maxIterations must be positive');
    let iteration = 0;
    let awaitingFinalResponse = false;

    while (iteration < this.config.maxIterations) {
      iteration++;
      if (abortSignal.aborted) throw new DOMException('已停止', 'AbortError');

      const modelMessages: HarnessModelMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];
      const modelTools = await this.buildTools(toolMetadata, sessionId);
      const modelStartedAt = Date.now();
      this.trace?.({
        type: 'model_call_started',
        label: '模型调用 ' + iteration,
        payload: {
          iteration,
          model: this.config.model,
          maxTokens: this.config.maxTokens,
          toolNames: modelTools.map((tool) => tool.name),
          messages: modelMessages,
          tools: modelTools,
        },
      });

      let fullContent = '';
      const pendingToolCalls: PendingToolCall[] = [];

      try {
        const stream = this.model.stream({
          config: this.config, messages: modelMessages, tools: modelTools, signal: abortSignal,
        });

        for await (const chunk of stream) {
          if (chunk.content) {
            fullContent += chunk.content;
            yield chunk.content;
          }

          if (chunk.toolCalls) {
            for (const tc of chunk.toolCalls) {
              const idx = tc.index;
              if (!pendingToolCalls[idx]) {
                pendingToolCalls[idx] = { id: '', name: '', arguments: '' };
              }
              if (tc.id) pendingToolCalls[idx].id = tc.id;
              if (tc.name) pendingToolCalls[idx].name += tc.name;
              if (tc.arguments) pendingToolCalls[idx].arguments += tc.arguments;
            }
          }
        }

        this.trace?.({
          type: 'model_call_completed',
          label: '模型返回 ' + iteration,
          durationMs: Date.now() - modelStartedAt,
          payload: {
            iteration,
            content: fullContent,
            toolCalls: pendingToolCalls,
          },
        });
      } catch (error) {
        this.trace?.({
          type: 'model_call_error',
          label: '模型调用失败 ' + iteration,
          durationMs: Date.now() - modelStartedAt,
          payload: {
            iteration,
            error: error instanceof Error ? error.message : String(error),
            aborted: abortSignal.aborted,
          },
        });
        throw error;
      }

      if (pendingToolCalls.length === 0) {
        awaitingFinalResponse = false;
        break;
      }
      awaitingFinalResponse = true;

      // Build assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: fullContent || null,
        toolCalls: pendingToolCalls,
      });

      // Execute each tool call
      for (const tc of pendingToolCalls) {
        if (!tc.name) continue;

        const tool = this.registry.getTool(tc.name);
        if (!tool) {
          this.trace?.({
            type: 'tool_error',
            label: '未知工具 ' + tc.name,
            payload: { tool: tc.name, toolCallId: tc.id },
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: 'Unknown tool: ' + tc.name }),
            toolCallId: tc.id,
          });
          continue;
        }

        let params: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(tc.arguments || '{}');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Tool arguments must be an object');
          params = parsed as Record<string, unknown>;
        } catch {
          this.trace?.({
            type: 'tool_error',
            label: '工具参数解析失败 ' + tc.name,
            payload: { tool: tc.name, toolCallId: tc.id, arguments: tc.arguments },
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: 'Invalid JSON arguments' }),
            toolCallId: tc.id,
          });
          continue;
        }

        const content = await executeToolCall({
          registry: this.registry,
          cache: this.cache,
          trace: this.trace,
          emit: (event) => this.emit(event),
          sessionId,
          abortSignal,
          confirmHandler,
          tool,
          policy: this.policy,
        }, tc, params);

        messages.push({
          role: 'tool',
          content,
          toolCallId: tc.id,
        });
      }
    }
    if (awaitingFinalResponse) throw new Error('Maximum model iterations reached before a final response');
  }
}
