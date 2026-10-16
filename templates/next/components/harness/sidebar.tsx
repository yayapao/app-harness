'use client';

import { useEffect } from 'react';
import { PlusIcon } from '@animateicons/react/lucide/plus-icon';
import { XIcon } from '@animateicons/react/lucide/x-icon';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { HarnessSidebarProps } from '@/types';

export function HarnessSidebar({
  sessions,
  sessionId,
  busy,
  open,
  onOpenChange,
  onCreate,
  onSelect,
  onCloseAutoFocus,
}: HarnessSidebarProps) {
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(min-width: 640px)');
    const closeOnDesktop = () => {
      if (media.matches) onOpenChange(false);
    };
    closeOnDesktop();
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [open, onOpenChange]);

  const content = (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
        <span className="text-sm font-medium">对话</span>
        <div className="flex items-center gap-1">
          <AnimatedIconButton
            icon={PlusIcon}
            label="新建对话"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              onCreate();
            }}
          />
          {open && (
            <DialogClose asChild>
              <AnimatedIconButton
                icon={XIcon}
                label="关闭会话侧栏"
                variant="ghost"
                size="icon-sm"
                className="sm:hidden"
              />
            </DialogClose>
          )}
        </div>
      </div>
      <nav
        aria-label="对话列表"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
      >
        {sessions.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">暂无对话</p>
        )}
        {sessions.map((session) => (
          <Button
            key={session.id}
            variant={session.id === sessionId ? 'secondary' : 'ghost'}
            disabled={busy}
            aria-current={session.id === sessionId ? 'true' : undefined}
            onClick={() => {
              onOpenChange(false);
              onSelect(session.id);
            }}
            className="min-h-10 w-full justify-start px-2 py-2 text-[13px]"
          >
            <span className="truncate" title={session.title}>
              {session.title}
            </span>
          </Button>
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/70 bg-muted/20 sm:flex">
        {content}
      </aside>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          id="harness-mobile-conversations"
          layout="panel"
          showCloseButton={false}
          aria-describedby={undefined}
          className="top-[max(0.75rem,calc((100dvh-760px)/2))] left-3 h-[min(760px,calc(100dvh-1.5rem))] w-64 max-w-[calc(100%-3rem)] translate-x-0 translate-y-0 sm:hidden"
          overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-none"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            onOpenChange(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseAutoFocus();
          }}
        >
          <DialogTitle className="sr-only">会话侧栏</DialogTitle>
          {content}
        </DialogContent>
      </Dialog>
    </>
  );
}
