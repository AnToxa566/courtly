import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';

// Sonner's own CSS is unlayered, so Tailwind utilities lose to it. Colours go
// through its CSS variables and the shadow through an inline style instead.
// richColors is what makes Sonner read the --success-* and --error-* variables.
const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      duration={5000}
      closeButton
      richColors
      icons={{
        success: <CircleCheckIcon className="size-5 text-court" />,
        error: <CircleAlertIcon className="size-5 text-destructive" />,
      }}
      style={
        {
          // The cast is needed because CSSProperties has no custom properties.
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--card)',
          '--success-text': 'var(--foreground)',
          '--success-border': 'var(--border)',
          '--error-bg': 'var(--brick-tint)',
          '--error-text': 'var(--destructive)',
          '--error-border':
            'color-mix(in srgb, var(--destructive) 30%, transparent)',
          '--border-radius': 'var(--radius-xl)',
        } as CSSProperties
      }
      toastOptions={{
        style: { boxShadow: 'none' },
        classNames: {
          title: 'text-sm! font-medium!',
          description: 'text-sm! text-muted-foreground!',
          error: '[&_[data-description]]:text-destructive!',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
