import { PLATFORM_ID, Service, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

/** Same key the inline script in index.html reads before first paint — keep them in sync. */
const STORAGE_KEY = 'ballastasera.theme';

/** Browser chrome colour (Android status bar), matching the top edge of the
 * navbar's mobile bar in each theme — same values as the inline script in index.html. */
const THEME_COLORS: Record<Theme, string> = { dark: '#1a0e2e', light: '#c9e2f6' };

/**
 * The visitor's light/dark choice, persisted in localStorage and applied as
 * `data-theme` on <html>. Dark unless they've picked light, since that's the
 * rest of the app's only look. The inline script in index.html sets that
 * same attribute before Angular boots, so an SSR page never flashes the wrong
 * theme; this service only handles changes made afterwards (the sidebar's
 * toggle).
 *
 * Pages opt in by styling off `[data-theme]` — for now the landing, /evento/:id
 * and the navbar have a light version; everything else stays dark regardless.
 */
@Service()
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly current = signal<Theme>(this.readTheme());
  readonly theme = this.current.asReadonly();

  toggle(): void {
    this.apply(this.current() === 'dark' ? 'light' : 'dark');
  }

  private apply(theme: Theme): void {
    this.current.set(theme);
    if (!this.isBrowser) return;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Storage blocked (private mode, disabled cookies): the choice still
      // applies for this visit, it just won't be remembered.
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }

  private readTheme(): Theme {
    if (!this.isBrowser) return 'dark';
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
