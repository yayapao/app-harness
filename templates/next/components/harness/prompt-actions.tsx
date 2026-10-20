'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PromptTarget } from '@/harness/core/message-actions';

export function PromptActions({
  prompt,
  disabled,
  target,
}: {
  prompt: string;
  disabled?: boolean;
  target?: PromptTarget;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  async function copyPrompt() {
    setError('');
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
      setError('复制失败，请重试');
    }
  }
  return (
    <div className="space-y-1">
      <div role="group" aria-label="提示词操作" className="flex max-w-full flex-wrap gap-1.5">
        {target && (
          <Button
            type="button"
            size="sm"
            disabled={disabled || !prompt.trim()}
            onClick={() => {
              setError('');
              try {
                Promise.resolve(target.open(prompt)).catch(() =>
                  setError('打开失败，请复制提示词后继续'),
                );
              } catch {
                setError('打开失败，请复制提示词后继续');
              }
            }}
          >
            <ExternalLink aria-hidden className="size-3.5" />
            {target.label}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={disabled || !prompt.trim()}
          aria-label={copied ? '已复制提示词' : '复制提示词'}
          onClick={() => void copyPrompt()}
        >
          {copied ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied ? '已复制' : '复制 Prompt'}
        </Button>
      </div>
      {error && (
        <p role="status" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
