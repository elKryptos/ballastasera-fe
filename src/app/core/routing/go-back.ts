import { inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/**
 * A page's "Indietro": back only when there's an in-app page to return to.
 * Opened straight from a shared link, the page is the router's first
 * navigation (navigationId 1 in history.state) and location.back() would
 * leave the app — or do nothing in a fresh tab — so it goes to `fallback`
 * instead. Call from an injection context (a field initializer):
 * `protected readonly goBack = injectGoBack('/mappa');`
 */
export function injectGoBack(fallback: string): () => void {
  const location = inject(Location);
  const router = inject(Router);
  return () => {
    const state = location.getState() as { navigationId?: number } | null;
    if ((state?.navigationId ?? 1) > 1) {
      location.back();
    } else {
      router.navigate([fallback]);
    }
  };
}
