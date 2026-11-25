import { DOCUMENT, DestroyRef, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, catchError, exhaustMap, filter, fromEvent, merge, skip, throttleTime } from 'rxjs';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { AuthService } from './auth.service';
import { FeatureFlagService } from './feature-flag.service';
import { NotificationsService } from './notifications.service';

/** At most this often: moving between pages, or back to the tab, doesn't ask every time. */
const CHECK_AT_MOST_EVERY_MS = 60_000;

/**
 * Keeps the bell's number up to date while the app is open, without polling for nothing: asked on
 * signing in (and on app start), then on moving to another page and on coming back to the tab, at
 * most once a minute (social-fe.md, S9). Signed out, it's zero. Call once, from an injection context
 * that lives as long as the app (the navbar), like watchOrganizerRequest.
 */
export function watchUnreadNotifications(): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  if (!inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.social)) return;

  const auth = inject(AuthService);
  const notifications = inject(NotificationsService);
  const document = inject(DOCUMENT);
  const ask = () => notifications.loadUnread().pipe(catchError(() => EMPTY));

  effect(() => {
    const signedIn = auth.isAuthenticated();
    untracked(() => (signedIn ? ask().subscribe() : notifications.clearUnread()));
  });

  merge(
    // Not the app's first navigation: the effect above has just asked.
    inject(Router).events.pipe(filter((event) => event instanceof NavigationEnd), skip(1)),
    fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')),
  )
    .pipe(
      filter(() => auth.isAuthenticated()),
      throttleTime(CHECK_AT_MOST_EVERY_MS),
      // A slow answer doesn't pile up another question behind it.
      exhaustMap(ask),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe();
}
