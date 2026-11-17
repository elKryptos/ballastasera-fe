import { CanActivateFn, Route, Routes } from '@angular/router';
import { claimLinkGuard, noPendingRequestGuard, pendingRequestGuard, requestStepGuard } from './organizer-request.guards';
import { OrganizerRequestFormStore, RequestStep } from './organizer-request-form.store';
import { OrganizerRequestLayout } from './organizer-request-layout';

/** extraGuards run after the step's own: by then the draft is this user's (requestStepGuard). */
function wizardStep(path: RequestStep, loadComponent: Route['loadComponent'], ...extraGuards: CanActivateFn[]): Route {
  return { path, canActivate: [noPendingRequestGuard, requestStepGuard(path), ...extraGuards], loadComponent };
}

export const ORGANIZER_REQUEST_ROUTES: Routes = [
  {
    path: '',
    component: OrganizerRequestLayout,
    // One draft for all the steps, kept while the user moves between them.
    providers: [OrganizerRequestFormStore],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'chi-sei' },
      wizardStep('chi-sei', () => import('./steps/chi-sei/chi-sei').then((m) => m.ChiSei), claimLinkGuard),
      wizardStep('profilo', () => import('./steps/profilo/profilo').then((m) => m.Profilo)),
      wizardStep('locale', () => import('./steps/locale/locale').then((m) => m.Locale)),
      wizardStep('conferma', () => import('./steps/conferma/conferma').then((m) => m.Conferma)),
      {
        path: 'richiesta-inviata',
        canActivate: [pendingRequestGuard],
        loadComponent: () => import('./steps/richiesta-inviata/richiesta-inviata').then((m) => m.RichiestaInviata),
      },
    ],
  },
];
