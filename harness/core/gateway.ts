import type {
  HarnessMessage,
  HarnessSession,
  HarnessStreamEvent,
  HarnessSessionLog,
  MentionMatch,
  HarnessGatewayOptions,
  HarnessCacheStore,
  HarnessPlugin,
} from './types';
import { HarnessRegistry } from './registry';
import { HarnessOrchestrator } from './orchestrator';
import { HarnessCache } from './cache';
import { AsyncEventQueue } from './event-queue';
import { createConfirmHandler } from './gateway/confirmation';
import { resolveContextBlocks, resolveMentions } from './gateway/mentions';
import { createRunLog, createTraceRecorder } from './gateway/run-log';

export class HarnessGateway {
  private registry: HarnessRegistry;
  private options: HarnessGatewayOptions;
  private sessions = new Map<string, HarnessSession>();
  private activeRuns = new Map<string, AbortController>();
  private cache: HarnessCacheStore;
  constructor(options: HarnessGatewayOptions) {
    this.options = options;
    this.registry = new HarnessRegistry();
    this.cache = options.cache ?? new HarnessCache();
    for (const plugin of options.plugins) {
      this.registry.registerPlugin(plugin);
    }
  }

  getSession(sessionId: string): HarnessSession | undefined {
    return this.sessions.get(sessionId);
  }

  forgetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  async createSession(title?: string): Promise<HarnessSession> {
    const session = await this.options.store.createConversation(title);
    session.installedSkillIds = this.registry.getAllSkills().map((s) => s.id);
    this.sessions.set(session.id, session);
    return session;
  }

  getCapabilities() {
    return this.registry.getCapabilities();
  }

  static updatePlugins(gateway: HarnessGateway, plugins: HarnessPlugin[]) {
    const registry = new HarnessRegistry();
    for (const plugin of plugins) registry.registerPlugin(plugin);
    // Active orchestrators keep their registry; later runs receive the new code tools.
    gateway.registry = registry;
    gateway.options.plugins = plugins;
  }

  listSessionLogs(sessionId?: string): Promise<HarnessSessionLog[]> {
    return this.options.store.listRuns(sessionId);
  }

  stopSession(sessionId: string): boolean {
    const controller = this.activeRuns.get(sessionId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  resolveMentions(rawMessage: string): MentionMatch[] {
    return resolveMentions(this.registry, rawMessage, this.options.defaultMentionType);
  }

  private async resolveContextBlocks(mentions: MentionMatch[]): Promise<string[]> {
    return resolveContextBlocks(this.registry, mentions);
  }

  private static isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  async rewindSession(sessionId: string, messageCount: number): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.runState !== 'idle') return false;
    const rewound = await this.options.store.rewindMessages(sessionId, messageCount);
    if (!rewound) return false;
    session.messages = session.messages.slice(0, messageCount);
    session.updatedAt = Date.now();
    return true;
  }

  async *handleChat(
    sessionId: string,
    userMessage: string,
    abortSignal: AbortSignal,
    rewindTo?: number,
  ): AsyncGenerator<HarnessStreamEvent> {
    abortSignal.throwIfAborted();
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.options.store.getConversation(sessionId) ?? await this.createSession();
      session.installedSkillIds = this.registry.getAllSkills().map((skill) => skill.id);
      sessionId = session.id;
      this.sessions.set(sessionId, session);
    }

    session.updatedAt = Date.now();

    if (rewindTo !== undefined && !await this.rewindSession(sessionId, rewindTo)) {
      yield {
        type: 'error',
        message: '无法从这条消息重新开始',
        recoverable: true,
      };
      return;
    }

    if (session.runState !== 'idle') {
      yield {
        type: 'error',
        message: '当前会话正在处理另一条消息',
        recoverable: true,
      };
      return;
    }

    const stopController = new AbortController();
    const stopRun = () => stopController.abort();
    abortSignal.addEventListener('abort', stopRun, { once: true });
    session.runState = 'running';
    this.activeRuns.set(sessionId, stopController);
    const release = () => {
      abortSignal.removeEventListener('abort', stopRun);
      this.activeRuns.delete(sessionId);
      session.runState = 'idle';
      session.updatedAt = Date.now();
    };
    let runConfig: typeof this.options.config;
    try {
      runConfig = await this.options.loadConfig?.() ?? this.options.config;
    } catch (error) {
      release();
      yield { type: 'error', message: error instanceof Error ? error.message : String(error), recoverable: false };
      return;
    }
    const runLog = createRunLog(sessionId, userMessage);
    try {
      await this.options.store.createRun(runLog);
    } catch (error) {
      release();
      yield { type: 'error', message: error instanceof Error ? error.message : String(error), recoverable: false };
      return;
    }
    const recordTrace = createTraceRecorder(runLog, (log) => this.options.store.saveRunTrace(log), this.options.tracePayloads);

    let mentions: MentionMatch[];
    let contextBlocks: string[];
    try {
      mentions = this.resolveMentions(userMessage);
      contextBlocks = await this.resolveContextBlocks(mentions);
      recordTrace({
        type: 'run_started',
        label: '运行开始',
        payload: {
          model: runConfig.model,
          maxIterations: runConfig.maxIterations,
          maxTokens: runConfig.maxTokens,
          request: userMessage,
        },
      });
      recordTrace({
        type: 'context_resolved',
        label: '上下文解析',
        payload: { mentions, contextBlocks },
      });

      const userRecord: HarnessMessage = {
        id: crypto.randomUUID(), role: 'user', content: userMessage,
        timestamp: Date.now(), mentions,
      };
      if (session.messages.every((message) => message.role !== 'user')) {
        session.title = userMessage.slice(0, 24);
        await this.options.store.touchConversation(sessionId, session.title);
      }
      await this.options.store.appendMessage(sessionId, userRecord);
      session.messages.push(userRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runLog.status = 'failed';
      runLog.error = message;
      runLog.finishedAt = Date.now();
      recordTrace({ type: 'run_failed', label: '运行失败', payload: { error: message } });
      try {
        await recordTrace.flush();
        await this.options.store.finishRun(runLog);
      } finally {
        release();
      }
      yield { type: 'error', message, recoverable: false };
      return;
    }

    yield { type: 'session_started', sessionId };

    let fullResponse = '';
    let messageAction: HarnessMessage['action'];

    const eventQueue = new AsyncEventQueue<HarnessStreamEvent>();
    const orchestrator = new HarnessOrchestrator(
      runConfig,
      this.registry,
      this.cache,
      (event: HarnessStreamEvent) => {
        if (event.type === 'tool_progress') {
          recordTrace({
            type: 'tool_progress',
            label: event.message,
            payload: { tool: event.tool, percent: event.percent },
          });
        }
        eventQueue.push(event);
        if (event.type === 'tool_call_completed' && event.result !== undefined) {
          const action = this.options.actionFromToolResult?.(event.tool, event.result);
          if (action) {
            messageAction = action;
            eventQueue.push({ type: 'message_action', action });
          }
        }
      },
      recordTrace,
      this.options.policy,
      this.options.systemInstructions,
      this.options.model,
    );

    const recentMessages = session.messages.slice(-20).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    const confirmHandler = createConfirmHandler(session, stopController, recordTrace);

    try {
      const runTask = (async () => {
        try {
          if (this.options.preprocessMessage) {
            const prepared = await this.options.preprocessMessage({
              message: userMessage,
              abortSignal: stopController.signal,
              stream: (event) => eventQueue.push(event),
              trace: recordTrace,
            });
            contextBlocks.push(...prepared.contextBlocks);
            messageAction = prepared.action;
            if (messageAction) eventQueue.push({ type: 'message_action', action: messageAction });
          }
          stopController.signal.throwIfAborted();
          const toolMetadata = await this.options.loadModelToolMetadata?.() ?? {};
          recordTrace({
            type: 'context_selected',
            label: '选择模型上下文',
            payload: { messageCount: recentMessages.length, messages: recentMessages, contextBlocks },
          });
          for await (const textChunk of orchestrator.run(
            recentMessages,
            contextBlocks,
            sessionId,
            stopController.signal,
            confirmHandler,
            toolMetadata,
          )) {
            fullResponse += textChunk;
            eventQueue.push({ type: 'message_delta', content: textChunk });
          }
          eventQueue.push({ type: 'done' });
        } catch (error) {
          const stopped = stopController.signal.aborted;
          const errMsg = stopped ? '已停止' : (error instanceof Error ? error.message : String(error));
          runLog.status = stopped ? 'stopped' : 'failed';
          runLog.error = errMsg;
          runLog.finishedAt = Date.now();
          recordTrace({
            type: 'run_failed',
            label: stopped ? '运行已停止' : '运行失败',
            payload: { error: errMsg, stopped },
          });
          await recordTrace.flush();
          await this.options.store.finishRun(runLog);
          eventQueue.push({
            type: 'error',
            message: errMsg,
            recoverable: stopped || HarnessGateway.isAbortError(error),
          });
        } finally {
          eventQueue.close();
        }
      })();

      for await (const event of eventQueue.stream()) {
        yield event;
      }
      await runTask;

      const assistantRecord: HarnessMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        action: messageAction,
      };
      await this.options.store.appendMessage(sessionId, assistantRecord);
      session.messages.push(assistantRecord);
      if (runLog.status === 'running') {
        runLog.status = stopController.signal.aborted ? 'stopped' : 'completed';
        runLog.finishedAt = Date.now();
        if (stopController.signal.aborted) runLog.error = '已停止';
      }
      runLog.result = fullResponse;
      if (runLog.status === 'completed') recordTrace({
        type: 'run_completed', label: '运行完成',
        payload: { status: runLog.status, responseLength: fullResponse.length },
      });
      await recordTrace.flush();
      await this.options.store.finishRun(runLog);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      runLog.status = 'failed';
      runLog.error = errMsg;
      runLog.finishedAt = Date.now();
      recordTrace({
        type: 'run_failed',
        label: '运行失败',
        payload: { error: errMsg },
      });
      await recordTrace.flush();
      await this.options.store.finishRun(runLog);
      yield { type: 'error', message: errMsg, recoverable: false };
    } finally {
      release();
    }
  }

  handleConfirmation(sessionId: string, confirmationId: string, answer: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.pendingConfirmation) return false;
    if (session.pendingConfirmation.id !== confirmationId) return false;
    session.pendingConfirmation.resolve(answer);
    session.pendingConfirmation = undefined;
    return true;
  }
}
