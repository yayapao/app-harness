'use client';

import { FileText, Slash } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComposerOption = { id: string; label: string; group: string; description?: string };
export function ComposerMenu({
  id,
  options,
  active,
  onSelect,
  onActive,
  loading,
  error,
}: {
  id: string;
  options: ComposerOption[];
  active: number;
  loading: boolean;
  error?: string;
  onSelect: (index: number) => void;
  onActive: (index: number) => void;
}) {
  return (
    <div className="absolute bottom-[calc(100%+0.5rem)] left-0 z-10 w-full max-w-sm overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
      <div
        id={id}
        role="listbox"
        aria-label="指令或引用候选"
        className="max-h-[min(300px,35dvh)] overflow-y-auto overscroll-contain p-1.5"
      >
        {options.map((option, index) => (
          <div key={option.id}>
            {options[index - 1]?.group !== option.group && (
              <p role="presentation" className="px-2.5 py-1.5 text-[10px] text-muted-foreground">
                {option.group}
              </p>
            )}
            <button
              id={`${id}-${index}`}
              type="button"
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onActive(index)}
              onClick={() => onSelect(index)}
              className={cn(
                'flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs',
                index === active ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              {option.id.startsWith('ref:') ? (
                <FileText aria-hidden className="size-4 shrink-0" />
              ) : (
                <Slash aria-hidden className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{option.label}</span>
                {option.description && (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
            </button>
          </div>
        ))}
        {(loading || error || !options.length) && (
          <p role="status" className="px-2.5 py-2 text-xs text-muted-foreground">
            {loading ? '正在查找引用' : error || '没有匹配的指令或引用'}
          </p>
        )}
      </div>
    </div>
  );
}
