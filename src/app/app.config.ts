import { ApplicationConfig, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouteReuseStrategy, Router, TitleStrategy, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco } from '@jsverse/transloco';
import { provideHlmSidebarConfig } from '@spartan-ng/helm/sidebar';

import { routes } from './app.routes';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { KeepAliveReuseStrategy } from './core/routing/keep-alive-reuse.strategy';
import { AuthService } from './core/services/auth.service';
import { SeoService } from './core/services/seo.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { AVAILABLE_LANGS, DEFAULT_LANG } from './core/config/i18n';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Cross-fades route changes via the browser's View Transitions API
    // instead of the hard cut-over you get by default; see the
    // ::view-transition-* rules in styles.css for the actual timing/easing.
    // A navigation opts out with info: { skipViewTransition: true } — a tab
    // switched on the page itself (MyNights), where fading the whole page out
    // and back in would only flicker. Not skipTransition(): that rejects the
    // transition's promises, which the router logs as errors in dev mode.
    // The class turns the fade off instead (styles.css), until it's over.
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: ({ transition }) => {
          const info = inject(Router).currentNavigation()?.extras.info as { skipViewTransition?: boolean } | undefined;
          if (!info?.skipViewTransition) return;
          const root = inject(DOCUMENT).documentElement;
          root.classList.add('no-route-fade');
          const done = () => root.classList.remove('no-route-fade');
          transition.finished.then(done, done);
        },
      }),
    ),
    // Keeps routes flagged `data: { keepAlive: true }` (the map) alive
    // across navigations instead of rebuilding them on every visit.
    { provide: RouteReuseStrategy, useClass: KeepAliveReuseStrategy },
    // Each page's own title, description and canonical URL, after every
    // navigation — see SeoService.
    { provide: TitleStrategy, useExisting: SeoService },
    // Starts as an icon-only rail on desktop (matches the md:pl-(--sidebar-width-icon)
    // gutter every page reserves for it). Widths kept in sync with --sidebar-width
    // and --sidebar-width-icon in styles.css. The menu's links close the mobile
    // drawer themselves (Navbar.closeDrawer) and leave the desktop rail as it is.
    // The mobile drawer: 85% of the screen, so its longest rows ("Serate che
    // ti piacciono" and its chip) fit from an iPhone SE up, with a strip of
    // page left to tap it closed.
    provideHlmSidebarConfig({
      defaultOpen: false,
      sidebarWidth: '18rem',
      sidebarWidthMobile: 'min(85vw, 20rem)',
      sidebarWidthIcon: '3.5rem',
    }),
    // Without this, HttpClient calls made during SSR (incl. the i18n JSON
    // the transloco loader fetches) aren't reused on the client — it just
    // re-fetches everything from scratch right after hydration.
    // includeNonCacheableRequests: Spring Security sends every API response
    // with "Cache-Control: no-cache, no-store", which kept them all out of
    // the transfer state — a reloaded event's page asked for it twice. That
    // header is for HTTP caches; this one lasts one page load, and holds only
    // what the server asked, without a token: public answers. The browser's
    // requests for them go without one too (PUBLIC_API), or the cache would
    // pass over them for a signed-in visitor.
    provideClientHydration(withHttpTransferCacheOptions({ includeNonCacheableRequests: true })),
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
    provideAppInitializer(() => inject(AuthService).startSession()),
  ]
};
