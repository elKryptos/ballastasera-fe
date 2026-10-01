import { ApplicationConfig, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { RouteReuseStrategy, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { provideHlmSidebarConfig } from '@spartan-ng/helm/sidebar';

import { routes } from './app.routes';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { KeepAliveReuseStrategy } from './core/routing/keep-alive-reuse.strategy';
import { AuthService } from './core/services/auth.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { AVAILABLE_LANGS, DEFAULT_LANG } from './core/config/i18n';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Cross-fades route changes via the browser's View Transitions API
    // instead of the hard cut-over you get by default; see the
    // ::view-transition-* rules in styles.css for the actual timing/easing.
    provideRouter(routes, withViewTransitions()),
    // Keeps routes flagged `data: { keepAlive: true }` (the map) alive
    // across navigations instead of rebuilding them on every visit.
    { provide: RouteReuseStrategy, useClass: KeepAliveReuseStrategy },
    // Starts as an icon-only rail on desktop (matches the md:pl-(--sidebar-width-icon)
    // gutter every page reserves for it). Widths kept in sync with --sidebar-width
    // and --sidebar-width-icon in styles.css. The menu's links close the mobile
    // drawer themselves (Navbar.closeDrawer) and leave the desktop rail as it is.
    provideHlmSidebarConfig({
      defaultOpen: false,
      sidebarWidth: '18rem',
      sidebarWidthIcon: '3.5rem',
    }),
    // Without this, HttpClient calls made during SSR (incl. the i18n JSON
    // the transloco loader fetches) aren't reused on the client — it just
    // re-fetches everything from scratch right after hydration.
    provideClientHydration(withHttpTransferCacheOptions({})),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [...AVAILABLE_LANGS],
        defaultLang: DEFAULT_LANG,
        fallbackLang: DEFAULT_LANG,
        // Needed for the language switch to actually repaint: this app has
        // no zone.js (zoneless change detection), so without this flag
        // nothing tells Angular to re-check the tree after setActiveLang().
        reRenderOnLangChange: true,
        prodMode: environment.production,
      },
      loader: TranslocoHttpLoader,
    }),
    // Purely to satisfy PWA install criteria (Chrome/Android requires a
    // registered, controlling service worker before it'll offer to install
    // the app) and to cache the static build output. `navigationUrls: []`
    // in ngsw-config.json keeps it from ever intercepting page navigations,
    // so it doesn't change the SSR/prerender/canonical-redirect behaviour
    // this app relies on — every route still always hits the network.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(
      () =>
        new Promise<void>((resolve) => {
          inject(AuthService)
            .restoreSession()
            .subscribe({ complete: resolve });
        }),
    ),
  ]
};
