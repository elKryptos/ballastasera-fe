import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { AVAILABLE_LANGS, isAppLang } from './core/config/i18n';
import { readLangCookie } from './core/i18n/lang-cookie';
import { KeepAliveHooks } from './core/routing/keep-alive-reuse.strategy';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ballastasera-fe');

  private readonly transloco = inject(TranslocoService);

  constructor() {
    // Runs once, browser-only, right after the first render/hydration has
    // settled — doing this any earlier races with SSR hydration, since the
    // '' route is prerendered (a single static HTML file baked at build
    // time, always in the default lang) and switching language before
    // hydration reconciles against that fixed markup corrupts it.
    afterNextRender(() => {
      void this.restoreSavedLang();

      // Warm the languages the visitor didn't land in, in the background,
      // so a manual switch later never has to wait on a network request —
      // it just flips to an already-cached translation.
      for (const lang of AVAILABLE_LANGS) {
        this.transloco.load(lang).subscribe();
      }

      // Loads silently fall back to the fallback language on failure — log
      // it so a stuck/wrong language shows up somewhere instead of looking
      // like the switcher "just didn't work".
      this.transloco.events$.subscribe((event) => {
        if (event.type === 'translationLoadFailure') {
          console.error(`[i18n] failed to load "${event.payload.langName}", using fallback instead`, event.payload);
        }
      });
    });
  }

  /** The outlet's attach/detach only fire for keep-alive routes (see
   * KeepAliveReuseStrategy) — forwarded to the page, which otherwise has no
   * way to tell it just went off or back on screen. */
  protected routeAttached(component: unknown): void {
    (component as KeepAliveHooks).onRouteAttached?.();
  }

  protected routeDetached(component: unknown): void {
    (component as KeepAliveHooks).onRouteDetached?.();
  }

  private async restoreSavedLang(): Promise<void> {
    const savedLang = readLangCookie(document.cookie);
    if (!isAppLang(savedLang) || savedLang === this.transloco.getActiveLang()) {
      return;
    }
    // Load before activating so the switch is atomic — no frame where the
    // template renders missing keys while the fetch is still in flight.
    await firstValueFrom(this.transloco.load(savedLang));
    this.transloco.setActiveLang(savedLang);
  }
}
