'use client';

import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HarnessMessagesProps } from '@/types';
import { cn } from '@/lib/utils';

function AssistantAvatar({ welcome = false }: { welcome?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
        welcome ? 'size-10' : 'size-7'
      )}
    >
      <Bot className={welcome ? 'size-6' : 'size-4'} />
    </span>
  );
}

export function HarnessMessages({
  messages,
  busy,
  progress,
  error,
  demo,
  onSuggest,
}: HarnessMessagesProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const sticky = useRef(true);
  const follow = () => {
    if (sticky.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  };
  useEffect(follow, [messages, busy, progress, error]);
  useEffect(() => {
    const observer = new ResizeObserver(follow);
    if (viewport.current) observer.observe(viewport.current);
    if (content.current) observer.observe(content.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={viewport}
      role="log"
      aria-live="polite"
      aria-busy={busy}
      aria-label="对话消息"
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6"
      onScroll={(event) => {
        const element = event.currentTarget;
        sticky.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      }}
    >
      <div
        ref={content}
        className="mx-auto flex min-h-full w-full max-w-3xl flex-col py-6"
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-10">
            <AssistantAvatar welcome />
            <h2 className="text-center text-lg font-medium leading-7">
              今天想聊什么？
            </h2>
            {demo && (
              <div className="flex flex-wrap justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="text-xs text-muted-foreground"
                  onClick={() => onSuggest('当前时间')}
                >
                  当前时间
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  className="text-xs text-muted-foreground"
                  onClick={() => onSuggest('保存便签：接入业务数据')}
                >
                  保存便签
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-7">
            {messages.map((message, index) => {
              const user = message.role === 'user';
              const waiting =
                !user &&
                busy &&
                index === messages.length - 1 &&
                !message.content;
              return (
                <article
                  key={message.id}
                  aria-label={user ? '你的消息' : '助手消息'}
                  className={cn(
                    'group min-w-0',
                    user
                      ? 'flex flex-col items-end'
                      : 'grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3'
                  )}
                >
                  {!user && <AssistantAvatar />}
                  <div className={cn('min-w-0', user && 'max-w-[92%]')}>
                    <div
                      className={cn(
                        'whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]',
                        user && 'rounded-lg bg-muted px-4 py-3'
                      )}
                    >
                      {waiting ? (
                        <span
                          role="status"
                          className="inline-flex min-h-7 items-center gap-2 text-xs text-muted-foreground"
                        >
                          {progress || '正在思考'}
                          <span aria-hidden className="inline-flex gap-1">
                            {[0, 1, 2].map((dot) => (
                              <span
                                key={dot}
                                className="size-1 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                                style={{ animationDelay: `${dot * 150}ms` }}
                              />
                            ))}
                          </span>
                        </span>
                      ) : (
                        message.content || '未生成回复'
                      )}
                    </div>
                    <time
                      className="mt-1 block text-[11px] text-muted-foreground tabular-nums sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      dateTime={new Date(message.timestamp).toISOString()}
                    >
                      {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-destructive pl-3 text-xs leading-5 text-destructive [overflow-wrap:anywhere]"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
