import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { provideHlmSidebarConfig } from '@spartan-ng/helm/sidebar';

import { routes } from './app.routes';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Starts as an icon-only rail on desktop (matches the md:pl-(--sidebar-width-icon)
    // gutter every page reserves for it) and closes the mobile drawer as soon
    // as a nav link inside it is clicked.
    provideHlmSidebarConfig({
      defaultOpen: false,
      sidebarWidth: '13rem',
      sidebarWidthIcon: '3rem',
      closeMobileSidebarOnMenuButtonClick: true,
    }),
    // Without this, HttpClient calls made during SSR (incl. the i18n JSON
    // the transloco loader fetches) aren't reused on the client — it just
    // re-fetches everything from scratch right after hydration.
    provideClientHydration(withHttpTransferCacheOptions({})),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['it', 'en', 'es'],
        defaultLang: 'it',
        fallbackLang: 'it',
        // Needed for the language switch to actually repaint: this app has
        // no zone.js (zoneless change detection), so without this flag
        // nothing tells Angular to re-check the tree after setActiveLang().
        // The earlier hydration bug wasn't caused by this — it was caused by
        // restoring the saved language too early (see afterNextRender in
        // app.ts), which is what actually needed fixing.
        reRenderOnLangChange: true,
        prodMode: environment.production,
      },
      loader: TranslocoHttpLoader,
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
