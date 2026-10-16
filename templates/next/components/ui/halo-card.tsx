'use client';

import { forwardRef } from 'react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import styles from './halo.module.css';

export const HaloCard = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  function HaloCard({ className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        data-slot="halo-card"
        className={cn('group', styles.surface, styles.card, className)}
        {...props}
      />
    );
  }
);

export function HaloCardHeader({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      data-slot="halo-card-header"
      className={cn('flex min-w-0 flex-1 flex-col gap-2', className)}
      {...props}
    />
  );
}

export function HaloCardTitle({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="halo-card-title"
      className={cn('text-sm font-medium', className)}
      {...props}
    />
  );
}

export function HaloCardDescription({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      data-slot="halo-card-description"
      className={cn('text-xs leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}
