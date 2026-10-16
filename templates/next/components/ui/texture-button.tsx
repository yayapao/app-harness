import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { TextureButtonProps } from '@/types';

// Cult UI Texture Button, adapted from Niu. See cult-ui.LICENSE.
const frame = cva(
  'group/texture inline-flex shrink-0 items-stretch justify-center overflow-hidden rounded-md border p-px text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
  {
    variants: {
      variant: {
        outline:
          'border-border bg-border/60 text-foreground hover:border-ring/60',
        primary:
          'border-primary bg-primary text-primary-foreground hover:border-ring/60',
      },
      size: { sm: 'h-7', default: 'h-8' },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  }
);

export function TextureButton({
  variant = 'outline',
  size = 'default',
  className,
  children,
  ...props
}: TextureButtonProps) {
  return (
    <button
      type="button"
      data-slot="texture-button"
      className={cn(frame({ variant, size }), className)}
      {...props}
    >
      <span
        className={cn(
          'flex h-full w-full items-center justify-center gap-2 rounded-sm bg-linear-to-b px-3 [&_svg]:size-4 [&_svg]:shrink-0',
          variant === 'primary'
            ? 'from-primary to-primary/90'
            : 'from-card to-secondary/70 group-hover/texture:from-secondary',
          size === 'sm' && 'text-xs'
        )}
      >
        {children}
      </span>
    </button>
  );
}
