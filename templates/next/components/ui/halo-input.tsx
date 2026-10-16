'use client';

import { forwardRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './halo.module.css';

export const HaloInput = forwardRef<
  HTMLInputElement,
  ComponentProps<'input'> & {
    trailingSlot?: ReactNode;
  }
>(function HaloInput(
  { className, disabled, trailingSlot, 'aria-invalid': invalid, ...props },
  ref
) {
  return (
    <div
      data-slot="halo-input-shell"
      data-invalid={invalid === true || invalid === 'true'}
      data-disabled={disabled || undefined}
      className={cn(styles.surface, styles.inputShell)}
    >
      <input
        ref={ref}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={invalid}
        data-slot="halo-input"
        className={cn(
          'h-full w-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground',
          className
        )}
        {...props}
      />
      {trailingSlot ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {trailingSlot}
        </span>
      ) : null}
    </div>
  );
});
