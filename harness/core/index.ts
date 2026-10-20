export { HarnessGateway } from './gateway';
export { HarnessOrchestrator } from './orchestrator';
export { HarnessRegistry } from './registry';
export { HarnessCache } from './cache';
export type {
  ContextProvider,
  HarnessCapabilities,
  HarnessCacheStore,
  HarnessAgent,
  HarnessGatewayOptions,
  HarnessMessage,
  HarnessMessageAction,
  HarnessMessagePreprocessor,
  HarnessModel,
  HarnessModelChunk,
  HarnessModelMessage,
  HarnessModelTool,
  HarnessParameterSchema,
  HarnessPlugin,
  HarnessSession,
  HarnessSessionLog,
  HarnessSkill,
  HarnessStore,
  HarnessStreamEvent,
  HarnessTraceEntry,
  HarnessTraceSink,
  HarnessTool,
  HarnessToolPolicy,
  MentionMatch,
  ModelToolMetadata,
  OrchestratorConfig,
  ToolContext,
  ToolPermission,
} from './types';

export { runStructuredTask, StructuredTaskError } from './structured-task';
export { composerTrigger, replaceComposerToken, insertComposerTrigger, referenceToken, composerCommands } from './composer';
export type { ComposerTrigger, ComposerCommand, ReferenceSuggestion, ReferenceSearchContext } from './composer';
export { safeLinkSchema, portalSourceSchema, portalDesignSchema, validatePortalDesign, parsePortalProposal, buildPortalPrompt, portalActionFromResult } from './resource-portal';
export type { PortalSource, PortalDesign, PortalProposal } from './resource-portal';
export { promptHandoffSchema } from './message-actions';
export type { PromptTarget } from './message-actions';
