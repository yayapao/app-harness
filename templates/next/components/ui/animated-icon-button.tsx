'use client';

import { useRef } from 'react';
import Link from 'next/link';
import type { IconHandle } from '@animateicons/react';
import { useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AnimatedIconButtonProps } from '@/types';
import { cn } from '@/lib/utils';

export function AnimatedIconButton({
  icon: Icon,
  label,
  iconSize = 16,
  href,
  scroll,
  disabled,
  className,
  onClick,
  size = 'icon',
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...props
}: AnimatedIconButtonProps) {
  const icon = useRef<IconHandle>(null);
  const reducedMotion = useReducedMotion();
  const start = () => {
    if (!reducedMotion) icon.current?.startAnimation();
  };
  const stop = () => icon.current?.stopAnimation();
  const graphic = (
    <Icon ref={icon} size={iconSize} isAnimated={false} aria-hidden />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={size}
          aria-label={label}
          {...props}
          asChild={!!href}
          disabled={href ? undefined : disabled}
          aria-disabled={disabled || undefined}
          tabIndex={href && disabled ? -1 : props.tabIndex}
          className={cn(
            className,
            href && disabled && 'pointer-events-none opacity-50'
          )}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            onClick?.(event);
          }}
          onMouseEnter={(event) => {
            start();
            onMouseEnter?.(event);
          }}
          onMouseLeave={(event) => {
            stop();
            onMouseLeave?.(event);
          }}
          onFocus={(event) => {
            start();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            stop();
            onBlur?.(event);
          }}
        >
          {href ? (
            <Link href={href} scroll={scroll}>
              {graphic}
            </Link>
          ) : (
            graphic
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
