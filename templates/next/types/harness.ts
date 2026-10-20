import type {
  HarnessCapabilities,
  HarnessMessage,
  HarnessSessionLog,
  HarnessStreamEvent,
  OrchestratorConfig,
} from '@/harness/core';
import type { ComponentProps } from 'react';
import type { MorphPopoverContent } from '@/components/ui/morph-popover';

export interface HarnessConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface HarnessInitialData {
  mode: 'demo' | 'openai';
  settings: OrchestratorConfig;
  sessions: HarnessConversationSummary[];
  sessionId: string;
  messages: HarnessMessage[];
  capabilities: HarnessCapabilities;
  logs: HarnessSessionLog[];
}

export interface HarnessPanelProps {
  initialData: HarnessInitialData;
  presentation?: 'page' | 'dialog';
  promptTarget?: import('@/harness/core/message-actions').PromptTarget;
}

export interface HarnessSidebarProps {
  sessions: HarnessConversationSummary[];
  sessionId: string;
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onCloseAutoFocus: () => void;
}

export interface HarnessMessagesProps {
  messages: HarnessMessage[];
  busy: boolean;
  progress: string;
  error: string;
  demo: boolean;
  promptTarget?: import('@/harness/core/message-actions').PromptTarget;
  onSuggest: (message: string) => void;
}

export type HarnessSettingsData = Pick<
  HarnessInitialData,
  'mode' | 'settings' | 'capabilities'
>;

export interface HarnessCapabilityDetailsProps {
  skill: HarnessCapabilities['skills'][number];
  capabilities: HarnessCapabilities;
}

export interface HarnessCapabilityCardProps extends HarnessCapabilityDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: ComponentProps<
    typeof MorphPopoverContent
  >['onCloseAutoFocus'];
}

export interface HarnessChatState {
  busy: boolean;
  error: string;
  progress: string;
  confirmation: Extract<
    HarnessStreamEvent,
    { type: 'confirmation_request' }
  > | null;
}
