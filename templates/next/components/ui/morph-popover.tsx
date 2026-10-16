'use client';

import type { ComponentProps } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Popover } from 'radix-ui';
import { cn } from '@/lib/utils';
import styles from './halo.module.css';

export const MorphPopover = Popover.Root;
export const MorphPopoverAnchor = Popover.Anchor;
export const MorphPopoverTrigger = Popover.Trigger;
export const MorphPopoverClose = Popover.Close;

export function MorphPopoverContent({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Popover.Content>, 'forceMount' | 'asChild'>) {
  const reduceMotion = useReducedMotion();
  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        collisionPadding={16}
        data-slot="morph-popover-content"
        className="z-50 w-(--radix-popover-trigger-width) max-w-[calc(100vw-32px)] outline-none"
        {...props}
      >
        {/* Entrance motion stays local to the panel, independent of portal positioning. */}
        <motion.div
          className={cn(styles.surface, styles.popover, className)}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </Popover.Content>
    </Popover.Portal>
  );
}
