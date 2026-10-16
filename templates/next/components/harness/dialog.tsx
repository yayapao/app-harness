'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { XIcon } from '@animateicons/react/lucide/x-icon';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';
import type { HarnessInitialData } from '@/types';
import { HarnessPanel } from './panel';

export function HarnessDialog({
  initialData,
}: {
  initialData: HarnessInitialData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false);
          router.back();
        }
      }}
    >
      <DialogContent
        layout="panel"
        showCloseButton={false}
        className="h-[min(760px,calc(100dvh-1.5rem))] min-h-0"
        overlayClassName="bg-black/35 supports-backdrop-filter:backdrop-blur-none dark:bg-black/55"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById('harness-launcher')?.focus();
        }}
      >
        <DialogTitle className="sr-only">AI 对话</DialogTitle>
        <DialogDescription className="sr-only">
          会话、消息与操作确认
        </DialogDescription>
        {open ? (
          <HarnessPanel initialData={initialData} presentation="dialog" />
        ) : null}
        <DialogClose asChild>
          <AnimatedIconButton
            icon={XIcon}
            label="关闭对话"
            variant="ghost"
            size="icon-sm"
            iconSize={14}
            className="absolute top-2.5 right-3 text-muted-foreground hover:text-foreground"
          />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
