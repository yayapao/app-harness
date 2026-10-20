'use client';

import type { HarnessMessageAction } from '@/harness/core/types';
import { parsePortalProposal } from '@/harness/core/resource-portal';
import { promptHandoffSchema, type PromptTarget } from '@/harness/core/message-actions';
import { PromptActions } from './prompt-actions';
import { PortalCard } from './portal-card';

export function MessageAction({
  action,
  busy,
  target,
  onSuggest,
}: {
  action?: HarnessMessageAction;
  busy: boolean;
  target?: PromptTarget;
  onSuggest: (message: string) => void;
}) {
  if (!action) return null;
  if (action.type === 'portal_design') {
    let proposal;
    try {
      proposal = parsePortalProposal(action.proposal);
    } catch {
      return null;
    }
    return (
      <PortalCard proposal={proposal} disabled={busy} target={target} onRecommend={onSuggest} />
    );
  }
  const checked = promptHandoffSchema.safeParse(action);
  if (!checked.success) return null;
  return (
    <section
      aria-label={checked.data.title}
      className="mt-3 min-w-0 space-y-2 rounded-lg border border-border p-3"
    >
      <h3 className="text-sm font-medium">{checked.data.title}</h3>
      <PromptActions prompt={checked.data.prompt} disabled={busy} target={target} />
      <div className="flex flex-wrap gap-2">
        {checked.data.links?.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted focus-visible:outline-2"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
    </section>
  );
}
