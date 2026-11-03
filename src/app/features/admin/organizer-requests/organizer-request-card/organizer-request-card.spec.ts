import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrganizerRequestAdminDto } from '../../../../core/models/organizer-request.model';
import { VenuesSummaryDto } from '../../../../core/models/venue.model';
import { AdminService } from '../../../../core/services/admin.service';
import { OrganizerRequestCard } from './organizer-request-card';

const REQUEST = {
  id: 'r1',
  status: 'PENDING',
  type: 'NEW',
  organizerName: 'Tropical',
  organizerType: 'CLUB',
  logoUrl: null,
  instagram: 'tropical',
  contactEmail: 'a@b.it',
  phone: null,
  website: null,
  venueAddress: 'Via Gola 12',
  venueCityName: 'Milano',
  submittedAt: '2026-11-03T20:15:30.285607Z',
  requester: { displayName: 'Ana' },
  targetOrganizer: null,
  targetOrganizerVenues: [],
  previousRejections: 0,
} as unknown as OrganizerRequestAdminDto;

const conflict = (code: string) => new HttpErrorResponse({ status: 409, error: { errors: { code } } });

describe('OrganizerRequestCard', () => {
  let fixture: ComponentFixture<OrganizerRequestCard>;
  let approveBodies: unknown[];
  let answer: () => ReturnType<AdminService['approveOrganizerRequest']>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const button = (label: string) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  /** What the dialog's "Approva" calls. The dialog itself is the library's. */
  const approve = () => (fixture.componentInstance as unknown as { approve(): void }).approve();

  const render = async (request: Partial<OrganizerRequestAdminDto> = {}, createdVenueId: string | null = null) => {
    fixture = TestBed.createComponent(OrganizerRequestCard);
    fixture.componentRef.setInput('request', { ...REQUEST, ...request });
    fixture.componentRef.setInput('createdVenueId', createdVenueId);
    await fixture.whenStable();
  };

  beforeEach(() => {
    approveBodies = [];
    answer = () => of(REQUEST);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AdminService,
          useValue: {
            approveOrganizerRequest: (_: string, body: unknown) => {
              approveBodies.push(body);
              return answer();
            },
            rejectOrganizerRequest: () => answer(),
          },
        },
      ],
    });
  });

  describe('venue', () => {
    it('holds back approval while a type with a venue has none', async () => {
      await render();
      expect(text()).toContain('Manca il locale');
      expect(text()).toContain('Via Gola 12, Milano');
      expect(button('Approva')?.disabled).toBe(true);
    });

    it('allows it once the venue is created, and links it', async () => {
      await render({}, 'v9');
      expect(text()).toContain('Locale creato');
      expect(button('Approva')?.disabled).toBe(false);
      approve();
      expect(approveBodies).toEqual([{ venueId: 'v9' }]);
    });

    it('allows it for a page that has its venue', async () => {
      await render({
        type: 'CLAIM',
        venueAddress: null,
        targetOrganizerVenues: [{ id: 'v1', name: 'Sala', address: 'Via X', cityName: 'Milano' } as VenuesSummaryDto],
      });
      expect(text()).toContain('già collegato');
      expect(button('Approva')?.disabled).toBe(false);
    });

    it('asks for no venue from a type without one', async () => {
      await render({ organizerType: 'PERSON', venueAddress: null });
      expect(text()).not.toContain('Manca il locale');
      expect(button('Approva')?.disabled).toBe(false);
    });
  });

  describe('deciding', () => {
    it('says so when it goes through', async () => {
      await render({ organizerType: 'PERSON' });
      const reviewed: string[] = [];
      fixture.componentInstance.reviewed.subscribe((message) => reviewed.push(message));
      approve();
      expect(reviewed).toEqual(['Tropical: approvata.']);
    });

    it.each(['CONCURRENT_UPDATE', 'REQUEST_NOT_PENDING'])('hands %s to the list, to reload', async (code) => {
      await render({ organizerType: 'PERSON' });
      answer = () => throwError(() => conflict(code));
      let alreadyReviewed = 0;
      fixture.componentInstance.alreadyReviewed.subscribe(() => alreadyReviewed++);
      approve();
      expect(alreadyReviewed).toBe(1);
    });

    it('shows any other conflict on the card', async () => {
      await render({ organizerType: 'PERSON' });
      answer = () => throwError(() => conflict('ORGANIZER_ALREADY_CLAIMED'));
      approve();
      await fixture.whenStable();
      expect(text()).toContain('appena stata assegnata');
      expect(button('Approva')?.disabled).toBe(false);
    });

    it('tells the admin about a banned user', async () => {
      await render({ organizerType: 'PERSON' });
      answer = () => throwError(() => new HttpErrorResponse({ status: 403 }));
      approve();
      await fixture.whenStable();
      expect(text()).toContain('bloccato');
    });
  });

  describe('reviewed', () => {
    it('shows the reason instead of the buttons', async () => {
      await render({ status: 'REJECTED', rejectionReason: 'DUPLICATE', rejectionMessage: 'Già esiste', reviewedByName: 'Admin' });
      expect(text()).toContain('Doppione');
      expect(text()).toContain('Già esiste');
      expect(button('Rifiuta')).toBeUndefined();
    });
  });

  it('marks a second attempt', async () => {
    await render({ previousRejections: 1 });
    expect(text()).toContain('2º intento');
  });
});
