import { Signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, of, switchMap } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizersService } from '../../core/services/organizers.service';

/**
 * The name of the page the signed-in organizer owns, for the menu's profile
 * card. Follows the role, so it shows the moment someone's approved, and
 * OrganizersService.myOrganizer, so a new name shows the moment it's saved.
 * Null for anyone else, and if it doesn't load: the card shows the email
 * instead. Call from an injection context.
 */
export function injectMyOrganizerName(): Signal<string | null> {
  const auth = inject(AuthService);
  const organizers = inject(OrganizersService);
  const enabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage);

  const isOrganizer = computed(() => enabled && auth.currentUser()?.role === 'ORGANIZER');

  toObservable(isOrganizer)
    .pipe(
      filter(Boolean),
      switchMap(() => organizers.ensureMine().pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    )
    .subscribe();

  return computed(() => (isOrganizer() ? (organizers.myOrganizer()?.name ?? null) : null));
}
