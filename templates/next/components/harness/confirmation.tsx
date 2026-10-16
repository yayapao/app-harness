'use client';

import { useState } from 'react';
import type { HarnessChatState } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function HarnessConfirmation({
  confirmation,
  label,
  onAnswer,
  onCloseAutoFocus,
}: {
  confirmation: NonNullable<HarnessChatState['confirmation']>;
  label: string;
  onAnswer: (answer: string) => Promise<void>;
  onCloseAutoFocus: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState(
    confirmation.choice?.options[0]?.value ?? ''
  );
  async function answer(value: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onAnswer(value);
    } catch (error) {
      setError(error instanceof Error ? error.message : '确认失败');
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void answer('取消');
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-lg sm:max-w-125"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>确认操作</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <dl className="min-w-0 space-y-2 text-sm">
          {Object.entries(confirmation.params ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt className="mb-1 text-xs text-muted-foreground">
                {key === 'content' ? '内容' : key}
              </dt>
              <dd className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
        {confirmation.choice && (
          <Select value={choice} onValueChange={setChoice} disabled={busy}>
            <SelectTrigger className="w-full" aria-label="确认选项">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {confirmation.choice.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button disabled={busy} onClick={() => void answer('取消')}>
            取消
          </Button>
          <Button
            variant="default"
            disabled={busy}
            onClick={() =>
              void answer(confirmation.choice ? `confirm:${choice}` : '确认')
            }
          >
            {busy ? '提交中' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
