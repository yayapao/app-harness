'use client';

import { useRef, useState } from 'react';
import type { HarnessCapabilities } from '@/harness/core';
import { HarnessCapabilityCard } from './capability-card';

export function HarnessCapabilitiesList({
  capabilities,
}: {
  capabilities: HarnessCapabilities;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const active = useRef<string | null>(null);
  return (
    <section aria-label="已注册能力" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">已注册能力</h2>
        <dl className="flex gap-3 text-xs text-muted-foreground">
          <div className="flex gap-1">
            <dt>能力</dt>
            <dd className="font-mono">{capabilities.skills.length}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Agent</dt>
            <dd className="font-mono">{capabilities.agents.length}</dd>
          </div>
          <div className="flex gap-1">
            <dt>工具</dt>
            <dd className="font-mono">{capabilities.tools.length}</dd>
          </div>
        </dl>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {capabilities.skills.map((skill) => (
          <HarnessCapabilityCard
            key={skill.id}
            skill={skill}
            capabilities={capabilities}
            open={openId === skill.id}
            onOpenChange={(open) => {
              if (open) {
                active.current = skill.id;
                setOpenId(skill.id);
              } else if (active.current === skill.id) {
                active.current = null;
                setOpenId(null);
              }
            }}
            onCloseAutoFocus={(event) => {
              if (active.current && active.current !== skill.id)
                event.preventDefault();
            }}
          />
        ))}
      </div>
      {!capabilities.skills.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          无已注册能力
        </p>
      ) : null}
      {capabilities.contextProviders.map((provider) => (
        <div
          key={provider.type}
          className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground"
        >
          <span>{provider.displayName}</span>
          <span className="break-words">{provider.description}</span>
        </div>
      ))}
    </section>
  );
}
