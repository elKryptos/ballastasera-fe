import { DOCUMENT, DestroyRef, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, exhaustMap, filter, fromEvent, interval, merge, of } from 'rxjs';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { AuthService } from './auth.service';
import { FeatureFlagService } from './feature-flag.service';
import { OrganizerRequestsService } from './organizer-requests.service';

/** How often to ask while a request is in review and the tab is in view. */
const CHECK_EVERY_MS = 60_000;

/**
 * Keeps the signed-in user's request up to date for as long as the app is open,
 * so a decision by the admin shows without reloading: it's loaded for every
 * user, and asked for again while in review, on coming back to the tab and
 * once a minute with the tab in view. Only then: a request in any other state
 * only changes by the user's own hand. Call once, from an injection context
 * that lives as long as the app (the navbar).
 */
export function watchOrganizerRequest(): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  if (!inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage)) return;

  const auth = inject(AuthService);
  const requests = inject(OrganizerRequestsService);
  const document = inject(DOCUMENT);

  effect(() => {
    const user = auth.currentUser();
    if (user?.role !== 'USER') return;
    untracked(() => requests.ensureLoaded().pipe(catchError(() => of(null))).subscribe());
  });

  merge(fromEvent(document, 'visibilitychange'), interval(CHECK_EVERY_MS))
    .pipe(
      filter(() => document.visibilityState === 'visible' && requests.myRequest()?.status === 'PENDING'),
      // A slow answer doesn't pile up another question behind it.
      exhaustMap(() => requests.load().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(inject(DestroyRef)),
    )
    .subscribe();
}
