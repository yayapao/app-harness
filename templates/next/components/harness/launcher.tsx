'use client';

import { MessageCircleIcon } from '@animateicons/react/lucide/message-circle-icon';
import { AnimatedIconButton } from '@/components/ui/animated-icon-button';

/** Add this action to the host header or toolbar. */
export function HarnessLauncher() {
  return (
    <AnimatedIconButton
      id="harness-launcher"
      icon={MessageCircleIcon}
      label="AI 对话"
      href="/harness"
      scroll={false}
      variant="ghost"
    />
  );
}
