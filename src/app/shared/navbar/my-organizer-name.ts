import { Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { FEATURE_FLAGS } from '../../core/config/feature-flags';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizersService } from '../../core/services/organizers.service';

/**
 * The name of the page the signed-in organizer owns, for the menu's profile
 * card. Follows the role, so it shows the moment someone's approved. Null for
 * anyone else, and if it doesn't load: the card shows the email instead. Call
 * from an injection context.
 */
export function injectMyOrganizerName(): Signal<string | null> {
  const auth = inject(AuthService);
  const organizers = inject(OrganizersService);
  const enabled = inject(FeatureFlagService).isEnabled(FEATURE_FLAGS.organizerRequestPage);

  const isOrganizer = computed(() => enabled && auth.currentUser()?.role === 'ORGANIZER');

  return toSignal(
    toObservable(isOrganizer).pipe(
      switchMap((organizer) =>
        !organizer
          ? of(null)
          : organizers.getMyOrganizers().pipe(
              map((owned) => owned[0]?.name ?? null),
              catchError(() => of(null)),
            ),
      ),
    ),
    { initialValue: null },
  );
}
