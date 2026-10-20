export type ToolPermission = 'read' | 'write' | 'destructive';

export interface HarnessParameterSchema {
  type: string;
  description: string;
  enum?: string[];
  properties?: Record<string, HarnessParameterSchema>;
  items?: HarnessParameterSchema;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolContext {
  sessionId: string;
  messageId: string;
  abortSignal: AbortSignal;
  stream: (event: HarnessStreamEvent) => void;
}

export interface HarnessTool {
  name: string;
  description: string;
  category: string;
  parameters: {
    type: 'object';
    properties: Record<string, HarnessParameterSchema>;
    required?: string[];
  };
  outputDescription?: string;
  permission: ToolPermission;
  requiresConfirmation?: boolean;
  confirmationChoice?: {
    parameter: string;
    options: Array<{ value: string; label: string }>;
  };
  invalidates?: string[];
  cacheTtlMs?: number;
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ModelToolMetadata {
  description: string;
  parameterDescriptions: Record<string, string>;
}

export interface HarnessAgent {
  name: string;
  displayName: string;
  description: string;
  permission: ToolPermission;
  requiresConfirmation?: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, HarnessParameterSchema>;
    required?: string[];
  };
  outputDescription: string;
  estimatedDurationMs: number;
  supportsStreaming: boolean;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface MentionMatch {
  type: string;
  value: string;
  raw: string;
}

export interface ContextProvider {
  type: string;
  displayName: string;
  description: string;
  /** The host scopes candidates to its authenticated user/tenant. Search is read-only. */
  search?: (query: string, context: import('./composer').ReferenceSearchContext) => Promise<import('./composer').ReferenceSuggestion[]>;
  parse: (raw: string) => MentionMatch | null;
  resolve: (match: MentionMatch) => Promise<Record<string, unknown>>;
  format: (data: Record<string, unknown>) => string;
}

export interface HarnessSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  triggers?: string[];
  tools: HarnessTool[];
  agents?: HarnessAgent[];
  contextProviders?: ContextProvider[];
}

export interface HarnessPlugin {
  name: string;
  version: string;
  skills: HarnessSkill[];
}

export type HarnessStreamEvent =
  | { type: 'session_started'; sessionId: string }
  | { type: 'thinking'; content: string }
  | { type: 'message_delta'; content: string }
  | { type: 'message_action'; action: HarnessMessageAction }
  | { type: 'tool_call_started'; tool: string; params: Record<string, unknown> }
  | { type: 'tool_progress'; tool: string; message: string; percent?: number }
  | { type: 'tool_call_completed'; tool: string; summary: string; result?: unknown }
  | { type: 'agent_call_started'; agent: string; input: Record<string, unknown> }
  | { type: 'agent_progress'; agent: string; step: string; status: string }
  | { type: 'agent_call_completed'; agent: string; summary: string }
  | { type: 'confirmation_request'; id: string; question: string; options?: string[]; tool?: string; params?: Record<string, unknown>; choice?: HarnessTool['confirmationChoice'] }
  | { type: 'error'; message: string; recoverable: boolean }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } };

export type HarnessMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface HarnessMessageAction {
  type: string;
  [key: string]: unknown;
}

export interface HarnessMessage {
  id: string;
  role: HarnessMessageRole;
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
    result?: unknown;
    summary?: string;
  }>;
  mentions?: MentionMatch[];
  confirmation?: {
    id: string;
    question: string;
    options?: string[];
    answer?: string;
  };
  action?: HarnessMessageAction;
}

export type SessionRunState = 'idle' | 'running' | 'awaiting_confirmation';

export type SessionLogStatus = 'running' | 'completed' | 'failed' | 'stopped';

export type HarnessTraceType =
  | 'run_started'
  | 'message_routed'
  | 'context_resolved'
  | 'context_selected'
  | 'model_call_started'
  | 'model_call_completed'
  | 'model_call_error'
  | 'tool_started'
  | 'tool_progress'
  | 'tool_completed'
  | 'tool_error'
  | 'cache_hit'
  | 'cache_write'
  | 'cache_invalidated'
  | 'confirmation_requested'
  | 'confirmation_resolved'
  | 'state_changed'
  | 'run_completed'
  | 'run_failed';

export interface HarnessTraceEntry {
  id: string;
  at: number;
  type: HarnessTraceType;
  label: string;
  durationMs?: number;
  payload?: unknown;
}

export type HarnessTraceSink = (entry: Omit<HarnessTraceEntry, 'id' | 'at'>) => void;

export type HarnessMessagePreprocessor = (input: {
  message: string;
  abortSignal: AbortSignal;
  stream: (event: HarnessStreamEvent) => void;
  trace: HarnessTraceSink;
}) => Promise<{ contextBlocks: string[]; action?: HarnessMessageAction }>;

export interface HarnessSessionLog {
  id: string;
  sessionId: string;
  startedAt: number;
  finishedAt?: number;
  status: SessionLogStatus;
  request: string;
  result: string;
  error?: string;
  trace?: HarnessTraceEntry[];
}

export interface HarnessSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: HarnessMessage[];
  runState: SessionRunState;
  pendingConfirmation?: {
    id: string;
    tool: string;
    params: Record<string, unknown>;
    resolve: (answer: string) => void;
  };
  installedSkillIds: string[];
}

export interface HarnessCapabilities {
  tools: Array<Pick<HarnessTool, 'name' | 'description' | 'category' | 'permission'> & {
    requiresConfirmation: boolean;
  }>;
  agents: Array<Pick<HarnessAgent, 'name' | 'displayName' | 'description' | 'permission'> & {
    requiresConfirmation: boolean;
  }>;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    toolNames: string[];
    agentNames: string[];
    contextTypes: string[];
  }>;
  contextProviders: Array<{ type: string; displayName: string; description: string; searchable?: boolean }>;
}

export interface OrchestratorConfig {
  model: string;
  maxIterations: number;
  maxTokens: number;
}

export interface HarnessModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolCallId?: string;
}

export interface HarnessModelTool {
  name: string;
  description: string;
  parameters: HarnessTool['parameters'];
}

export interface HarnessModelChunk {
  content?: string;
  toolCalls?: Array<{ index: number; id?: string; name?: string; arguments?: string }>;
}

export interface HarnessModel {
  stream(input: {
    config: OrchestratorConfig;
    messages: HarnessModelMessage[];
    tools: HarnessModelTool[];
    signal: AbortSignal;
  }): AsyncIterable<HarnessModelChunk>;
}

export interface HarnessStore {
  createConversation(title?: string): Promise<HarnessSession>;
  getConversation(id: string): Promise<HarnessSession | null>;
  deleteConversation?(id: string): Promise<void>;
  touchConversation(id: string, title?: string): Promise<void>;
  appendMessage(id: string, message: HarnessMessage): Promise<void>;
  rewindMessages(id: string, count: number): Promise<boolean>;
  createRun(log: HarnessSessionLog): Promise<void>;
  saveRunTrace(log: HarnessSessionLog): Promise<void>;
  finishRun(log: HarnessSessionLog): Promise<void>;
  listRuns(id?: string): Promise<HarnessSessionLog[]>;
}

export interface HarnessCacheStore {
  get(key: string): Promise<unknown | undefined> | unknown | undefined;
  set(key: string, value: unknown, ttlMs: number): Promise<void> | void;
  invalidatePattern(prefix: string): Promise<void> | void;
}

export interface HarnessToolPolicy {
  authorize(tool: HarnessTool, sessionId: string): Promise<boolean> | boolean;
  cacheScope?(tool: HarnessTool, sessionId: string): string;
}

export interface HarnessGatewayOptions {
  config: OrchestratorConfig;
  plugins: HarnessPlugin[];
  store: HarnessStore;
  cache?: HarnessCacheStore;
  model: HarnessModel;
  policy: HarnessToolPolicy;
  systemInstructions?: string;
  defaultMentionType?: string;
  preprocessMessage?: HarnessMessagePreprocessor;
  actionFromToolResult?: (toolName: string, result: unknown) => HarnessMessageAction | null;
  loadModelToolMetadata?: () => Promise<Record<string, ModelToolMetadata>>;
  loadConfig?: () => Promise<OrchestratorConfig>;
  tracePayloads?: boolean;
}
