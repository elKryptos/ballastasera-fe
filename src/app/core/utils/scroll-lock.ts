import { DestroyRef, PLATFORM_ID, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Keeps the page from scrolling under a full-screen overlay (a lightbox)
 * while `locked()` is true — released on destroy too, or leaving the page
 * with the overlay open would keep every other page unscrollable. DOM-only,
 * so a no-op on the server. Call from an injection context.
 */
export function lockBodyScrollWhile(locked: () => boolean): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

  effect(() => {
    document.body.style.overflow = locked() ? 'hidden' : '';
  });
  inject(DestroyRef).onDestroy(() => {
    document.body.style.overflow = '';
  });
}
