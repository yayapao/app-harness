'use client';

import { createContext, useContext, useId, useState } from 'react';
import type { ComponentProps } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import styles from './halo-tabs.module.css';

// Cult UI Halo Tabs, adapted from Niu to Radix. See cult-ui.LICENSE.
const HaloContext = createContext({ value: '', indicator: '' });

export function HaloTabs({
  value,
  defaultValue = '',
  onValueChange,
  className,
  orientation = 'horizontal',
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>) {
  const [selected, setSelected] = useState(defaultValue);
  const indicator = useId();
  return (
    <HaloContext.Provider value={{ value: value ?? selected, indicator }}>
      <TabsPrimitive.Root
        {...props}
        value={value ?? selected}
        onValueChange={(next) => {
          setSelected(next);
          onValueChange?.(next);
        }}
        orientation={orientation}
        data-slot="halo-tabs"
        className={cn('flex min-w-0 flex-col gap-2', className)}
      />
    </HaloContext.Provider>
  );
}

export function HaloTabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      {...props}
      data-slot="halo-tabs-list"
      className={cn(styles.list, className)}
    />
  );
}

export function HaloTabsTrigger({
  value,
  children,
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  const context = useContext(HaloContext);
  const reducedMotion = useReducedMotion();
  return (
    <TabsPrimitive.Trigger
      {...props}
      value={value}
      data-slot="halo-tabs-trigger"
      className={cn(styles.trigger, className)}
    >
      {context.value === value ? (
        <motion.span
          aria-hidden
          className={styles.indicator}
          layoutId={context.indicator}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
        />
      ) : null}
      <span className="relative flex min-w-0 items-center justify-center gap-1.5">
        {children}
      </span>
    </TabsPrimitive.Trigger>
  );
}

export { TabsContent as HaloTabsContent } from './tabs';
