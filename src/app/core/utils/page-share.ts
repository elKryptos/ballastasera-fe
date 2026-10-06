import { DestroyRef, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** How long "Copiato" stays on the button that copied something. */
const COPIED_MS = 2000;

export interface PageShare<T extends string> {
  /** What was just copied — 'link' from share()'s fallback, or copy()'s
   * key — for a couple of seconds, so that button can say "Copiato". */
  readonly copied: Signal<T | 'link' | null>;
  /** The native share sheet where the browser has one, otherwise copies
   * the page's URL (as 'link'). */
  share(title: string): Promise<void>;
  copy(text: string, what: T | 'link'): Promise<void>;
}

/**
 * A page's share and copy buttons — the event's and the venue's. Call from
 * an injection context; `T` names what else the page copies ('address').
 */
export function injectPageShare<T extends string = never>(): PageShare<T> {
  const isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  const copied = signal<T | 'link' | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));

  const copy = async (text: string, what: T | 'link'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard API (insecure context) or permission denied: nothing to show.
      return;
    }
    copied.set(what);
    clearTimeout(timer);
    timer = setTimeout(() => copied.set(null), COPIED_MS);
  };

  const share = async (title: string): Promise<void> => {
    if (!isBrowser) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User dismissed the native share sheet: nothing to do.
      }
      return;
    }
    await copy(url, 'link');
  };

  return { copied: copied.asReadonly(), share, copy };
}
