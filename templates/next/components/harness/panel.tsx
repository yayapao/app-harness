'use client';

import { useRef, useState } from 'react';
import { ArrowLeftIcon } from '@animateicons/react/lucide/arrow-left-icon';
import { PanelLeftIcon } from '@animateicons/react/lucide/panel-left-icon';
import { Trash2Icon } from '@animateicons/react/lucide/trash-2-icon';
import { HistoryIcon } from '@animateicons/react/lucide/history-icon';
import { WrenchIcon } from '@animateicons/react/lucide/wrench-icon';
import { SettingsIcon } from '@animateicons/react/lucide/settings-icon';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { HarnessPanelProps } from '@/types';
import { cn } from '@/lib/utils';
import { useHarness } from './use-harness';
import { HarnessComposer } from './composer';
import { HarnessMessages } from './messages';
import { HarnessSidebar } from './sidebar';
import { HarnessConfirmation } from './confirmation';
import { HarnessInspect } from './inspect';

export function HarnessPanel({
  initialData,
  presentation = 'page',
  promptTarget,
}: HarnessPanelProps) {
  const harness = useHarness(initialData);
  const { data, state } = harness;
  const panel = useRef<HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpener = useRef<HTMLButtonElement>(null);
  const toolbarFocus = useRef<HTMLButtonElement>(null);
  const inspectOpener = useRef<HTMLElement | null>(null);
  const deleteOpener = useRef<HTMLButtonElement>(null);
  const [inspect, setInspect] = useState<'logs' | 'capabilities' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const title =
    data.sessions.find((session) => session.id === data.sessionId)?.title ||
    '新对话';

  return (
    <section
      ref={panel}
      aria-label="AI 对话"
      className={cn(
        'flex min-h-0 min-w-0',
        presentation === 'dialog' ? 'h-full flex-1' : 'h-[calc(100dvh-48px)]'
      )}
    >
      <HarnessSidebar
        sessions={data.sessions}
        sessionId={data.sessionId}
        busy={state.busy}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onCreate={() => void harness.create()}
        onSelect={(id) => void harness.select(id)}
        onCloseAutoFocus={() => {
          const target = sidebarOpener.current?.getClientRects().length
            ? sidebarOpener.current
            : toolbarFocus.current;
          target?.focus({ preventScroll: true });
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="h-12 shrink-0 px-3 sm:px-6">
          <div
            className={cn(
              'mx-auto flex h-full max-w-3xl items-center gap-2',
              presentation === 'dialog' && 'pr-8'
            )}
          >
            {presentation === 'page' && (
              <AnimatedIconButton
                icon={ArrowLeftIcon}
                label="返回工作台"
                href="/"
                variant="ghost"
                size="icon-sm"
              />
            )}
            <AnimatedIconButton
              ref={sidebarOpener}
              icon={PanelLeftIcon}
              label="展开会话侧栏"
              variant="ghost"
              size="icon-sm"
              className="sm:hidden"
              aria-expanded={sidebarOpen}
              aria-controls="harness-mobile-conversations"
              onClick={() => setSidebarOpen(true)}
            />
            <h2
              className="min-w-0 flex-1 truncate text-sm font-medium"
              title={title}
            >
              {title}
            </h2>
            <div className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <AnimatedIconButton
                ref={toolbarFocus}
                icon={WrenchIcon}
                label="已接入能力"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  inspectOpener.current = event.currentTarget;
                  setInspect('capabilities');
                }}
              />
              <AnimatedIconButton
                icon={HistoryIcon}
                label="运行记录"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  inspectOpener.current = event.currentTarget;
                  setInspect('logs');
                }}
              />
              <AnimatedIconButton
                icon={SettingsIcon}
                label="Harness 管理"
                variant="ghost"
                size="icon-sm"
                disabled={state.busy}
                href="/settings/harness"
              />
              <AnimatedIconButton
                ref={deleteOpener}
                icon={Trash2Icon}
                label="删除对话"
                variant="ghost"
                size="icon-sm"
                disabled={state.busy || !data.sessionId}
                onClick={() => setDeleting(true)}
              />
            </div>
          </div>
        </header>
        <HarnessMessages
          key={data.sessionId}
          messages={data.messages}
          busy={state.busy}
          progress={state.progress}
          error={state.error}
          demo={data.mode === 'demo'}
          promptTarget={promptTarget}
          onSuggest={(message) => void harness.send(message)}
        />
        <HarnessComposer
          key={data.sessionId}
          busy={state.busy}
          demo={data.mode === 'demo'}
          sessionId={data.sessionId}
          capabilities={data.capabilities}
          onSend={harness.send}
          onStop={harness.stop}
        />
      </div>
      {state.confirmation && (
        <HarnessConfirmation
          key={state.confirmation.id}
          confirmation={state.confirmation}
          label={
            data.capabilities.tools.find(
              (tool) => tool.name === state.confirmation?.tool
            )?.description ?? state.confirmation.question
          }
          onAnswer={harness.answer}
          onCloseAutoFocus={() =>
            panel.current
              ?.querySelector<HTMLElement>(
                'textarea:not(:disabled), button[aria-label="停止回答"]'
              )
              ?.focus({ preventScroll: true })
          }
        />
      )}
      <HarnessInspect
        view={inspect}
        data={data}
        onClose={() => setInspect(null)}
        onCloseAutoFocus={() =>
          inspectOpener.current?.focus({ preventScroll: true })
        }
      />
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent
          className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-lg sm:max-w-125"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            deleteOpener.current?.focus({ preventScroll: true });
          }}
        >
          <DialogHeader>
            <DialogTitle>删除对话</DialogTitle>
            <DialogDescription>删除当前对话及运行记录？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleting(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleting(false);
                void harness.remove();
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
