import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizerRequestFormStore, RequestStep, requestStepUrl } from './organizer-request-form.store';

/** A step opens only once the draft reaches it: reloading on a later step
 * loses the draft and lands on the first one that's missing something. */
export function requestStepGuard(step: RequestStep): CanActivateFn {
  return () => {
    const store = inject(OrganizerRequestFormStore);
    const router = inject(Router);
    store.ensureOwnDraft();
    return store.canEnter(step) || router.createUrlTree([requestStepUrl(store.firstIncompleteStep())]);
  };
}

/** The steps are for writing a new request: with one in review, show that one
 * instead. If this can't be checked the steps open, and sending would answer
 * PENDING_REQUEST_EXISTS anyway. */
export const noPendingRequestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(OrganizerRequestsService).ensureLoaded().pipe(
    catchError(() => of(null)),
    map((request) => (request?.status === 'PENDING' ? router.createUrlTree([requestStepUrl('richiesta-inviata')]) : true)),
  );
};

/** "Richiesta inviata" is about a request in review. Asks the backend afresh:
 * the admin may have reviewed it since it was loaded. If that fails it goes by
 * what it last knew: sending a known pending request to the steps would only
 * bounce back here (noPendingRequestGuard), over and over. */
export const pendingRequestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const requests = inject(OrganizerRequestsService);
  return requests.load().pipe(
    catchError(() => of(requests.myRequest())),
    map((request) => {
      if (request?.status === 'PENDING') return true;
      // Approved just now: asking again would be for someone else, the steps are closed to them.
      return router.createUrlTree([auth.currentUser()?.role === 'USER' ? requestStepUrl('chi-sei') : '/menu']);
    }),
  );
};
