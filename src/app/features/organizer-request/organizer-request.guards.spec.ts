import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  MaybeAsync,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { OrganizerDetailDto } from '../../core/models/organizer.model';
import { AuthService } from '../../core/services/auth.service';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { claimLinkGuard, noPendingRequestGuard, pendingRequestGuard, requestStepGuard } from './organizer-request.guards';
import { ClaimTarget, OrganizerRequestFormStore } from './organizer-request-form.store';

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

async function settle(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
  return isObservable(result) ? firstValueFrom(result) : result;
}

describe('organizer request guards', () => {
  const requests = {
    ensureLoaded: () => of(null as unknown),
    load: () => of(null as unknown),
    myRequest: () => null as unknown,
  };
  const store = {
    ensureOwnDraft: () => {},
    canEnter: () => true,
    firstIncompleteStep: () => 'chi-sei',
    startClaimOf: (target: ClaimTarget) => void claimed.push(target),
  };
  let claimed: ClaimTarget[];
  let organizerBySlug: (slug: string) => Observable<Partial<OrganizerDetailDto>>;
  let role: string;

  const redirectOf = (result: GuardResult) =>
    result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

  beforeEach(() => {
    requests.ensureLoaded = () => of(null);
    requests.load = () => of(null);
    requests.myRequest = () => null;
    store.canEnter = () => true;
    claimed = [];
    organizerBySlug = () => of({});
    role = 'USER';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => ({ role }) } },
        { provide: OrganizerRequestsService, useValue: requests },
        { provide: OrganizerRequestFormStore, useValue: store },
        { provide: OrganizersService, useValue: { getBySlug: (slug: string) => organizerBySlug(slug) } },
      ],
    });
  });

  const run = (guard: typeof noPendingRequestGuard) =>
    settle(TestBed.runInInjectionContext(() => guard(route, state)) as MaybeAsync<GuardResult>);

  it('sends a pending request from the steps to its page', async () => {
    requests.ensureLoaded = () => of({ status: 'PENDING' });
    expect(redirectOf(await run(noPendingRequestGuard))).toBe('/diventa-organizzatore/richiesta-inviata');
  });

  it.each([null, { status: 'REJECTED' }, { status: 'CANCELLED' }])('opens the steps with %j', async (request) => {
    requests.ensureLoaded = () => of(request);
    expect(await run(noPendingRequestGuard)).toBe(true);
  });

  it('opens the steps if the request cannot be checked', async () => {
    requests.ensureLoaded = () => throwError(() => new Error('down'));
    expect(await run(noPendingRequestGuard)).toBe(true);
  });

  it('sends away from "richiesta inviata" without a pending request', async () => {
    requests.load = () => of({ status: 'REJECTED' });
    expect(redirectOf(await run(pendingRequestGuard))).toBe('/diventa-organizzatore/chi-sei');
  });

  it('sends someone approved just now to the menu, not back to asking', async () => {
    requests.load = () => of({ status: 'APPROVED' });
    role = 'ORGANIZER';
    expect(redirectOf(await run(pendingRequestGuard))).toBe('/menu');
  });

  it('opens "richiesta inviata" with a pending request', async () => {
    requests.load = () => of({ status: 'PENDING' });
    expect(await run(pendingRequestGuard)).toBe(true);
  });

  // Redirecting here would bounce between the two guards without end.
  it('stays on a known pending request if it cannot be refreshed', async () => {
    requests.load = () => throwError(() => new Error('down'));
    requests.myRequest = () => ({ status: 'PENDING' });
    expect(await run(pendingRequestGuard)).toBe(true);
  });

  it('sends away if nothing is known and the request cannot be loaded', async () => {
    requests.load = () => throwError(() => new Error('down'));
    expect(redirectOf(await run(pendingRequestGuard))).toBe('/diventa-organizzatore/chi-sei');
  });

  it('sends a step the draft does not reach to the first incomplete one', async () => {
    store.canEnter = () => false;
    expect(redirectOf(await run(requestStepGuard('conferma')))).toBe('/diventa-organizzatore/chi-sei');
  });

  it('opens a step the draft reaches', async () => {
    expect(await run(requestStepGuard('profilo'))).toBe(true);
  });

  describe('claimLinkGuard', () => {
    const PAGE = { id: 'o1', name: 'Salsa Loca', slug: 'salsa-loca', type: 'SCHOOL' as const, logoUrl: null };

    const runWith = (params: Record<string, string>) =>
      settle(
        TestBed.runInInjectionContext(() =>
          claimLinkGuard({ queryParamMap: convertToParamMap(params) } as ActivatedRouteSnapshot, state),
        ) as MaybeAsync<GuardResult>,
      );

    it('opens "Chi sei?" as usual without a page to claim', async () => {
      organizerBySlug = () => throwError(() => new Error('not asked'));
      expect(await runWith({})).toBe(true);
      expect(claimed).toEqual([]);
    });

    it('picks a claimable page and goes on to "Il tuo profilo"', async () => {
      let asked = '';
      organizerBySlug = (slug) => ((asked = slug), of({ ...PAGE, claimable: true }));

      expect(redirectOf(await runWith({ rivendica: 'salsa-loca' }))).toBe('/diventa-organizzatore/profilo');
      expect(asked).toBe('salsa-loca');
      expect(claimed).toEqual([expect.objectContaining(PAGE)]);
    });

    // Without the param, or "Chi sei?" would ask for the page again on every visit.
    it('drops a page someone owns by now and starts the steps as usual', async () => {
      organizerBySlug = () => of({ ...PAGE, claimable: false });
      expect(redirectOf(await runWith({ rivendica: 'salsa-loca' }))).toBe('/diventa-organizzatore/chi-sei');
      expect(claimed).toEqual([]);
    });

    it('starts the steps as usual if the page does not load', async () => {
      organizerBySlug = () => throwError(() => new Error('404'));
      expect(redirectOf(await runWith({ rivendica: 'gone' }))).toBe('/diventa-organizzatore/chi-sei');
      expect(claimed).toEqual([]);
    });
  });
});
