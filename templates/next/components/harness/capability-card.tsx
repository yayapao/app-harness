'use client';

import { useId, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { XIcon } from '@animateicons/react/lucide/x-icon';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import {
  HaloCard,
  HaloCardDescription,
  HaloCardHeader,
  HaloCardTitle,
} from '@/components/ui/halo-card';
import {
  MorphPopover,
  MorphPopoverAnchor,
  MorphPopoverClose,
  MorphPopoverContent,
  MorphPopoverTrigger,
} from '@/components/ui/morph-popover';
import type { HarnessCapabilityCardProps } from '@/types';
import { HarnessCapabilityDetails } from './capability-details';

export function HarnessCapabilityCard({
  skill,
  capabilities,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: HarnessCapabilityCardProps) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [sideOffset, setSideOffset] = useState(0);
  return (
    <MorphPopover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && trigger.current)
          setSideOffset(-trigger.current.getBoundingClientRect().height);
        onOpenChange(nextOpen);
      }}
    >
      <MorphPopoverAnchor asChild>
        <div className="min-w-0">
          <MorphPopoverTrigger asChild>
            <HaloCard ref={trigger} aria-label={`${skill.name}，查看能力详情`}>
              <HaloCardHeader>
                <span className="flex items-center justify-between gap-3">
                  <HaloCardTitle className="min-w-0 break-words">
                    {skill.name}
                  </HaloCardTitle>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </span>
                <HaloCardDescription className="line-clamp-2">
                  {skill.description}
                </HaloCardDescription>
              </HaloCardHeader>
            </HaloCard>
          </MorphPopoverTrigger>
        </div>
      </MorphPopoverAnchor>
      {open ? (
        <MorphPopoverContent
          sideOffset={sideOffset}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <header className="flex shrink-0 items-start gap-3 px-4 pt-4 pb-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h3 id={`${id}-title`} className="text-sm font-medium">
                {skill.name}
              </h3>
              <p
                id={`${id}-description`}
                className="break-words text-xs leading-relaxed text-muted-foreground"
              >
                {skill.description}
              </p>
            </div>
            <MorphPopoverClose asChild>
              <AnimatedIconButton
                icon={XIcon}
                label="关闭能力详情"
                variant="ghost"
                size="icon-sm"
              />
            </MorphPopoverClose>
          </header>
          <HarnessCapabilityDetails skill={skill} capabilities={capabilities} />
        </MorphPopoverContent>
      ) : null}
    </MorphPopover>
  );
}
