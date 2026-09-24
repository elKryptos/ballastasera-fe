import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Not yet in lib.dom.d.ts — this is the event Chrome/Android fires instead
 * of showing its own install UI, so we can show ours and trigger it later. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Tracks whether the app can be installed as a PWA and from where:
 * - Android/Chrome fires `beforeinstallprompt`, which we capture and replay
 *   later via `promptInstall()` (must be called from a user gesture).
 * - iOS Safari never fires that event — there is no installable-from-JS API
 *   there at all — so `isIos` is exposed for the UI to show manual
 *   "Share -> Add to Home Screen" instructions instead.
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly platformId = inject(PLATFORM_ID);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly isIos = signal(false);
  readonly isStandalone = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Deferred to after the first render/hydration on purpose: the '' route
    // is prerendered (static HTML baked at build time, install UI always
    // absent there), so setting these signals synchronously in the
    // constructor would make the client's first hydration pass disagree
    // with that markup and corrupt hydration — same pitfall as the i18n
    // restore in app.ts.
    afterNextRender(() => {
      this.isStandalone.set(
        window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true,
      );

      // iPadOS Safari reports itself as "Macintosh" but with touch support;
      // that's the standard way to still tell it apart from a real Mac.
      const ua = navigator.userAgent;
      this.isIos.set(/iphone|ipad|ipod/i.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua)));

      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      });

      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.canInstall.set(false);
        this.isStandalone.set(true);
      });
    });
  }

  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
  }
}
