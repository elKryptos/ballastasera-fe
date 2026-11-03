import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrganizerRequestDto } from '../../../core/models/organizer-request.model';
import { FeatureFlagService } from '../../../core/services/feature-flag.service';
import { OrganizerRequestsService } from '../../../core/services/organizer-requests.service';
import { OrganizerMenuCard } from './organizer-menu-card';

const REQUEST = {
  id: 'r1',
  organizerName: 'Salsa Loca',
  submittedAt: new Date().toISOString(),
  rejectionReason: null,
  rejectionMessage: null,
  acknowledgedAt: null,
} as unknown as OrganizerRequestDto;

describe('OrganizerMenuCard', () => {
  let fixture: ComponentFixture<OrganizerMenuCard>;
  let acknowledged: string[];
  const myRequest = signal<OrganizerRequestDto | null>(null);
  const isLoaded = signal(false);
  const loadFailed = signal(false);

  const element = () => fixture.nativeElement as HTMLElement;
  const link = (label: string) => [...element().querySelectorAll('a')].find((a) => a.textContent?.includes(label));

  const create = async (flag = true) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: FeatureFlagService, useValue: { isEnabled: () => flag } },
        {
          provide: OrganizerRequestsService,
          useValue: {
            myRequest,
            isLoaded,
            loadFailed,
            acknowledge: (id: string) => {
              acknowledged.push(id);
              myRequest.update((current) => (current ? { ...current, acknowledgedAt: 'now' } : null));
              return of(myRequest());
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(OrganizerMenuCard);
    await fixture.whenStable();
  };

  const render = async (request: Partial<OrganizerRequestDto> | null) => {
    myRequest.set(request ? ({ ...REQUEST, ...request } as OrganizerRequestDto) : null);
    isLoaded.set(true);
    await create();
  };

  beforeEach(() => {
    acknowledged = [];
    myRequest.set(null);
    isLoaded.set(false);
    loadFailed.set(false);
  });

  it.each([
    ['no request', null],
    ['an approved one', { status: 'APPROVED' }],
    ['a cancelled one', { status: 'CANCELLED', acknowledgedAt: 'before' }],
  ] as const)('invites with %s', async (_, request) => {
    await render(request);
    expect(link('Diventa organizzatore')?.getAttribute('href')).toBe('/diventa-organizzatore');
    expect(element().textContent).not.toContain('In sviluppo');
  });

  it('says a pending request is in review, and links to it', async () => {
    await render({ status: 'PENDING' });
    expect(element().textContent).toContain('Richiesta in revisione');
    expect(element().textContent).toContain('Salsa Loca · inviata oggi');
    expect(link('Vedi la richiesta')?.getAttribute('href')).toBe('/diventa-organizzatore/richiesta-inviata');
    expect(link('Diventa organizzatore')).toBeUndefined();
  });

  it('gives the reason for a rejection, and the way to resubmit', async () => {
    await render({ status: 'REJECTED', rejectionReason: 'INSTAGRAM_NOT_FOUND', rejectionMessage: 'Scrivici da lì.' });
    expect(element().textContent).toContain('Richiesta non approvata');
    expect(element().textContent).toContain('Motivo: Instagram non trovato');
    expect(element().textContent).toContain('Scrivici da lì.');
    expect(link('Modifica e reinvia')?.getAttribute('href')).toBe('/diventa-organizzatore/chi-sei?da=r1');
    expect(acknowledged).toEqual([]);
  });

  it('follows the request when the admin decides, without being recreated', async () => {
    await render({ status: 'PENDING' });
    expect(element().textContent).toContain('Richiesta in revisione');

    myRequest.set({ ...REQUEST, status: 'REJECTED', rejectionReason: 'DUPLICATE' });
    await fixture.whenStable();
    expect(element().textContent).toContain('Richiesta non approvata');
    expect(element().textContent).toContain('Motivo: Doppione');
  });

  it('tells once that the admin removed the page, and keeps showing it', async () => {
    await render({ status: 'CANCELLED', rejectionMessage: 'La pagina è stata rimossa.' });
    await fixture.whenStable();
    expect(acknowledged).toEqual(['r1']);
    expect(element().textContent).toContain('La pagina è stata rimossa.');
    expect(link('Diventa organizzatore')).toBeDefined();
  });

  it('shows nothing until it knows, so the invitation does not flash', async () => {
    await create();
    expect(link('Diventa organizzatore')).toBeUndefined();
  });

  it('falls back to the invitation if the request cannot be loaded', async () => {
    loadFailed.set(true);
    await create();
    expect(link('Diventa organizzatore')).toBeDefined();
  });

  it('stays unlinked with the flag off', async () => {
    await create(false);
    expect(element().textContent).toContain('In sviluppo');
    expect(link('Diventa organizzatore')).toBeUndefined();
  });
});
