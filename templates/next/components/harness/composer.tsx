'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUp, AtSign, Plus, Slash, Square, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { Button } from '@/components/ui/button';
import {
  composerCommands,
  composerTrigger,
  insertComposerTrigger,
  referenceToken,
  replaceComposerToken,
  type ReferenceSuggestion,
} from '@/harness/core/composer';
import type { HarnessCapabilities } from '@/harness/core/types';
import { ComposerMenu } from './composer-menu';
import { useReferences } from './use-references';

export function HarnessComposer({
  busy,
  demo,
  sessionId,
  capabilities,
  onSend,
  onStop,
}: {
  busy: boolean;
  demo: boolean;
  sessionId: string;
  capabilities: HarnessCapabilities;
  onSend: (message: string) => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [references, setReferences] = useState<ReferenceSuggestion[]>([]);
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [provider, setProvider] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();
  const menu = !busy && !dismissed ? composerTrigger(message, caret) : null;
  const commands = composerCommands(capabilities, menu?.kind === 'command' ? menu.query : '');
  const candidates = useReferences(
    menu?.kind === 'reference' ? menu.query : null,
    provider,
    sessionId,
  );
  const options =
    menu?.kind === 'command'
      ? commands
      : candidates.items.map((item) => ({
          id: `ref:${item.type}:${item.value}`,
          label: item.label,
          description: item.description,
          group:
            capabilities.contextProviders.find((value) => value.type === item.type)?.displayName ??
            item.type,
        }));
  const selected = Math.min(active, options.length - 1);
  const focus = (position: number) =>
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(position, position);
    });
  const update = (next: { text: string; caret: number }) => {
    setMessage(next.text);
    setCaret(next.caret);
    setActive(0);
    focus(next.caret);
  };
  const open = (symbol: '@' | '/', type?: string) => {
    setProvider(type);
    setDismissed(false);
    setAdding(false);
    update(insertComposerTrigger(message, input.current?.selectionStart ?? message.length, symbol));
  };
  const choose = (index: number) => {
    if (!menu) return;
    if (menu.kind === 'command') {
      const command = commands[index];
      if (!command) return;
      update(replaceComposerToken(message, menu, command.prompt));
    } else {
      const item = candidates.items[index];
      if (!item) return;
      if (!references.some((value) => value.type === item.type && value.value === item.value))
        setReferences((current) => [...current, item]);
      update(replaceComposerToken(message, menu, ''));
    }
    setDismissed(true);
  };
  const send = async () => {
    if (busy) return;
    const text = [...references.map(referenceToken), message].join(' ').trim();
    if (!text) return;
    if (text.length > 6000) {
      setError('消息与引用合计最多 6000 字');
      return;
    }
    setError('');
    setMessage('');
    setReferences([]);
    setCaret(0);
    setDismissed(true);
    await onSend(text);
  };
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = '0px';
      input.current.style.height = `${Math.min(144, input.current.scrollHeight)}px`;
    }
  }, [message]);
  useEffect(() => {
    if (menu && selected >= 0)
      document.getElementById(`${menuId}-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [menuId, menu, selected]);

  return (
    <form
      className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(true);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="relative mx-auto w-full max-w-3xl rounded-lg border border-border bg-muted/20 p-2.5 focus-within:border-foreground/25 focus-within:ring-2 focus-within:ring-ring/10 sm:p-3">
        {menu && (
          <ComposerMenu
            id={menuId}
            options={options}
            active={selected}
            loading={menu.kind === 'reference' && candidates.loading}
            error={menu.kind === 'reference' ? candidates.error : undefined}
            onSelect={choose}
            onActive={setActive}
          />
        )}
        {references.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {references.map((item) => (
              <span
                key={`${item.type}:${item.value}`}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="truncate">{item.label}</span>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`移除引用：${item.label}`}
                  onClick={() => {
                    setReferences((current) => current.filter((value) => value !== item));
                    input.current?.focus();
                  }}
                >
                  <X aria-hidden className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={input}
          aria-label="消息"
          aria-autocomplete="list"
          aria-controls={menu ? menuId : undefined}
          aria-activedescendant={menu && selected >= 0 ? `${menuId}-${selected}` : undefined}
          placeholder="描述任务，/ 选择指令，@ 添加引用"
          value={message}
          rows={2}
          maxLength={6000}
          disabled={busy}
          className="block max-h-36 min-h-14 w-full resize-none bg-transparent px-0.5 py-1 text-sm leading-6 outline-none disabled:opacity-50"
          onChange={(event) => {
            setMessage(event.target.value);
            setCaret(event.target.selectionStart);
            setDismissed(false);
            setActive(0);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (menu) {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setDismissed(true);
                return;
              }
              if (options.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                setActive(
                  (value) =>
                    (value + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                    options.length,
                );
                return;
              }
              if (
                selected >= 0 &&
                ((event.key === 'Enter' && !event.shiftKey) ||
                  (event.key === 'Tab' && !event.shiftKey))
              ) {
                event.preventDefault();
                choose(selected);
                return;
              }
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <div className="mt-2 flex min-h-8 items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-0.5">
            <Popover.Root open={adding} onOpenChange={setAdding}>
              <Popover.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="添加内容"
                  disabled={busy}
                >
                  <Plus />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="top"
                  align="start"
                  sideOffset={10}
                  collisionPadding={12}
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    input.current?.focus();
                  }}
                  className="z-70 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                >
                  {capabilities.contextProviders
                    .filter((item) => item.searchable)
                    .map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        className="block min-h-10 w-full rounded-md px-2.5 text-left text-xs hover:bg-muted focus-visible:outline-2"
                        onClick={() => open('@', item.type)}
                      >
                        引用{item.displayName}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="block min-h-10 w-full rounded-md px-2.5 text-left text-xs hover:bg-muted focus-visible:outline-2"
                    onClick={() => open('/')}
                  >
                    指令与技能
                  </button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="添加引用"
              disabled={busy}
              onClick={() => open('@')}
            >
              <AtSign />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="指令与技能"
              disabled={busy}
              onClick={() => open('/')}
            >
              <Slash />
            </Button>
            {demo && <span className="ml-1 text-[10px] text-muted-foreground">演示</span>}
          </div>
          <Button
            type={busy ? 'button' : 'submit'}
            variant="ghost"
            size="icon"
            aria-label={busy ? '停止回答' : '发送消息'}
            disabled={!busy && !message.trim() && !references.length}
            onClick={busy ? () => void onStop() : undefined}
          >
            {busy ? <Square className="size-3.5 fill-current" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
