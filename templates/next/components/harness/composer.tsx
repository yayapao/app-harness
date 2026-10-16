'use client';

import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpIcon } from '@animateicons/react/lucide/arrow-up-icon';
import { Square } from 'lucide-react';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';

const schema = z.object({
  message: z.string().trim().min(1, '请输入消息').max(6000, '消息最多 6000 字'),
});

export function HarnessComposer({
  busy,
  demo,
  onSend,
  onStop,
}: {
  busy: boolean;
  demo: boolean;
  onSend: (message: string) => Promise<void>;
  onStop: () => Promise<void>;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { message: '' },
  });
  const message = useWatch({ control: form.control, name: 'message' });
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      input.current?.focus({ preventScroll: true })
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = '0px';
    input.current.style.height = `${Math.min(144, input.current.scrollHeight)}px`;
  }, [message]);

  return (
    <Form {...form}>
      <form
        className="shrink-0 px-3 pt-2 pb-3 sm:px-6 sm:pb-5"
        onSubmit={form.handleSubmit(async ({ message }) => {
          if (busy) return;
          form.reset();
          try {
            await onSend(message);
          } catch {
            form.setError('root', { message: '发送失败' });
          }
        })}
      >
        <div className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-muted/20 p-2.5 transition-[border-color,box-shadow] focus-within:border-foreground/25 focus-within:ring-2 focus-within:ring-ring/10 motion-reduce:transition-none sm:p-3">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem className="gap-1">
                <FormControl>
                  <textarea
                    {...field}
                    ref={(element) => {
                      field.ref(element);
                      input.current = element;
                    }}
                    aria-label="消息"
                    placeholder="描述你想完成的任务"
                    rows={2}
                    maxLength={6000}
                    disabled={busy}
                    className="block max-h-36 min-h-14 w-full resize-none bg-transparent px-0.5 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-50"
                    onKeyDown={(event) => {
                      if (
                        event.key !== 'Enter' ||
                        event.shiftKey ||
                        event.nativeEvent.isComposing ||
                        event.keyCode === 229
                      )
                        return;
                      event.preventDefault();
                      if (
                        !busy &&
                        !form.formState.isSubmitting &&
                        message.trim()
                      )
                        event.currentTarget.form?.requestSubmit();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-2 flex h-8 items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {demo ? (
                '演示模式'
              ) : (
                <span className="hidden sm:inline">
                  Enter 发送 · Shift+Enter 换行
                </span>
              )}
            </span>
            {busy ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    aria-label="停止回答"
                    className="size-8 rounded-md"
                    onClick={() => void onStop()}
                  >
                    <Square className="size-3.5 fill-current" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>停止回答</TooltipContent>
              </Tooltip>
            ) : (
              <AnimatedIconButton
                icon={ArrowUpIcon}
                label="发送"
                type="submit"
                variant="default"
                className="size-8 rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-25"
                disabled={form.formState.isSubmitting || !message.trim()}
              />
            )}
          </div>
          {form.formState.errors.root && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {form.formState.errors.root.message}
            </p>
          )}
        </div>
      </form>
    </Form>
  );
}
