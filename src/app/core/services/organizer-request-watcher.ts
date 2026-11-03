import { DOCUMENT, DestroyRef, PLATFORM_ID, computed, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { EMPTY, catchError, exhaustMap, filter, fromEvent, interval, map, merge, of, startWith } from 'rxjs';
import { FEATURE_FLAGS } from '../config/feature-flags';
import { AuthService } from './auth.service';
import { FeatureFlagService } from './feature-flag.service';
import { OrganizerRequestsService } from './organizer-requests.service';

/** How often to ask while a request is in review and the tab is in view. */
const CHECK_EVERY_MS = 60_000;

export const ORGANIZER_WELCOME_URL = '/benvenuto-organizzatore';

/**
 * Keeps the signed-in user's request up to date for as long as the app is open,
 * so a decision by the admin shows without reloading: it's loaded for users and
 * organizers, and asked for again while in review, on coming back to the tab
 * and once a minute with the tab in view. Only then: a request in any other
 * state only changes by the user's own hand. Whoever was just approved, now or
 * since their last visit, is taken to the welcome page, wherever they are, until
 * they've seen it. Call once, from an injection context that lives as long as
 * the app (the navbar).
 */
export function watchOrganizerRequest(): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  if (!inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage)) return;

  const auth = inject(AuthService);
  const requests = inject(OrganizerRequestsService);
  const router = inject(Router);
  const document = inject(DOCUMENT);

  effect(() => {
    const role = auth.currentUser()?.role;
    if (role !== 'USER' && role !== 'ORGANIZER') return;
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

  const owesWelcome = computed(() => {
    const request = requests.myRequest();
    return auth.currentUser()?.role === 'ORGANIZER' && request?.status === 'APPROVED' && !request.acknowledgedAt;
  });
  // Follows the URL too: another page's own redirect (the wizard's, on being
  // approved) can land after this one, and mustn't leave the welcome unseen.
  const url = toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => router.url),
      startWith(router.url),
    ),
    { requireSync: true },
  );

  effect(() => {
    if (owesWelcome() && url() !== ORGANIZER_WELCOME_URL) untracked(() => router.navigateByUrl(ORGANIZER_WELCOME_URL));
  });
}
