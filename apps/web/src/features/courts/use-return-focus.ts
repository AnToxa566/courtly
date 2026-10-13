import { useState, type RefObject } from 'react';

// The dialogs are opened by state, with no Radix Trigger. Radix's modal
// content returns focus on close with `context.triggerRef.current?.focus()`
// after calling preventDefault, and without a Trigger that ref is null, so
// focus would land on <body>. This remembers the element that was focused
// when the dialog mounted (the button that opened it, before Radix moves
// focus) and returns focus there. Pass the result as `onCloseAutoFocus`.
// `fallback` is for a list whose row, and so the opener, can disappear
// when the action succeeds (a cancelled booking leaves the Upcoming tab).
export function useReturnFocus(fallback?: RefObject<HTMLElement | null>) {
  const [opener] = useState(() => document.activeElement);
  return (event: Event) => {
    // Stops Radix's own handler, which would focus the missing trigger.
    event.preventDefault();
    // The opener can be gone, e.g. a Deactivate button replaced by Reactivate.
    if (opener instanceof HTMLElement && opener.isConnected) {
      opener.focus();
    } else {
      fallback?.current?.focus();
    }
  };
}
