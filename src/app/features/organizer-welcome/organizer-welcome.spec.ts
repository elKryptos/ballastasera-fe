import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, GuardResult, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { OrganizerRequestDto } from '../../core/models/organizer-request.model';
import { OrganizerRequestsService } from '../../core/services/organizer-requests.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { OrganizerWelcome, organizerWelcomeGuard } from './organizer-welcome';

const REQUEST = {
  id: 'r1',
  status: 'APPROVED',
  organizerName: 'Salsa Loca',
  organizerId: 'o1',
  organizerSlug: 'salsa-loca',
  logoUrl: null,
  acknowledgedAt: null,
} as unknown as OrganizerRequestDto;
const VENUE = { id: 'v1', name: 'Sala', address: 'Via Borsieri 12', cityName: 'Milano' };

describe('OrganizerWelcome', () => {
  let fixture: ComponentFixture<OrganizerWelcome>;
  let acknowledged: string[];
  let page: () => Observable<unknown>;
  const myRequest = signal<OrganizerRequestDto | null>(REQUEST);

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    acknowledged = [];
    myRequest.set(REQUEST);
    page = () => of({ detail: { logoUrl: null }, venues: [VENUE] });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: OrganizerRequestsService,
          useValue: {
            myRequest,
            ensureLoaded: () => of(myRequest()),
            acknowledge: (id: string) => {
              acknowledged.push(id);
              return of(null);
            },
          },
        },
        { provide: OrganizersService, useValue: { getWithVenues: () => page() } },
      ],
    });
  });

  const render = async () => {
    fixture = TestBed.createComponent(OrganizerWelcome);
    await fixture.whenStable();
  };

  it('names the page and its venue', async () => {
    await render();
    expect(text()).toContain('Sei un organizzatore!');
    expect(text()).toContain('Salsa Loca è tua ed è collegata al locale di Via Borsieri 12.');
    expect(text()).toContain('nella lista di Milano');
    expect(text()).toContain('Profilo e locale collegati');
  });

  it('reads right without a venue', async () => {
    page = () => of({ detail: { logoUrl: null }, venues: [] });
    await render();
    expect(text()).toContain('Salsa Loca è tua. Le serate che pubblichi compaiono sulla mappa e nella lista.');
    expect(text()).toContain('Profilo pronto');
    expect(text()).not.toContain('collegat');
  });

  it('reads fine if the page does not load', async () => {
    page = () => throwError(() => new Error('down'));
    await render();
    expect(text()).toContain('Salsa Loca è tua.');
    expect(text()).not.toContain('Manca ancora il logo');
  });

  it('asks for the logo only if it is missing', async () => {
    await render();
    expect(text()).toContain('Manca ancora il logo');
  });

  it('does not ask for a logo it has', async () => {
    page = () => of({ detail: { logoUrl: 'http://logo' }, venues: [VENUE] });
    await render();
    expect(text()).not.toContain('Manca ancora il logo');
  });

  it('counts as seen on leaving, not before', async () => {
    await render();
    expect(acknowledged).toEqual([]);
    fixture.destroy();
    expect(acknowledged).toEqual(['r1']);
  });

  describe('guard', () => {
    const run = async () => {
      const result = TestBed.runInInjectionContext(() =>
        organizerWelcomeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ) as Observable<GuardResult>;
      const outcome = await firstValueFrom(result);
      return outcome instanceof UrlTree ? TestBed.inject(Router).serializeUrl(outcome) : outcome;
    };

    it('opens for someone just approved', async () => {
      expect(await run()).toBe(true);
    });

    it('sends to the menu once seen', async () => {
      myRequest.set({ ...REQUEST, acknowledgedAt: '2026-11-03T20:00:00Z' });
      expect(await run()).toBe('/menu');
    });

    it('sends to the menu without an approval', async () => {
      myRequest.set(null);
      expect(await run()).toBe('/menu');
    });
  });
});
