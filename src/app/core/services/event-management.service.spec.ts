import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { EventCreateDto, EventDetailDto } from '../models/event.model';
import { OrganizerDetailDto } from '../models/organizer.model';
import { EventManagementService } from './event-management.service';
import { OrganizersService } from './organizers.service';

const url = (path: string) => `${environment.apiUrl}${path}`;
const BODY = { organizerId: 'o1', title: 'Social Salsa' } as EventCreateDto;
const NIGHT = { id: 'e1', title: 'Social Salsa', organizer: { id: 'o1' } } as EventDetailDto;

describe('EventManagementService', () => {
  let service: EventManagementService;
  let http: HttpTestingController;
  /** The signed-in user's page, as OrganizersService.ensureMine() answers. */
  let mine: OrganizerDetailDto | null;

  beforeEach(() => {
    mine = { id: 'o1' } as OrganizerDetailDto;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OrganizersService, useValue: { ensureMine: () => of(mine) } },
      ],
    });
    service = TestBed.inject(EventManagementService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('opening a night', () => {
    function open(scope: 'admin' | 'organizer', night: EventDetailDto | null): EventDetailDto | null | undefined {
      let opened: EventDetailDto | null | undefined;
      service.getManaged(scope, 'e1').subscribe((value) => (opened = value));
      const request = http.expectOne(url(endpoints.events.detail('e1')));
      if (night) request.flush(night);
      else request.flush(null, { status: 404, statusText: 'Not Found' });
      return opened;
    }

    it('opens the organizer\'s own night', () => {
      expect(open('organizer', NIGHT)).toEqual(NIGHT);
    });

    it('doesn\'t open another page\'s night for the organizer, as if it didn\'t exist', () => {
      expect(open('organizer', { ...NIGHT, organizer: { id: 'o2' } } as EventDetailDto)).toBeNull();
    });

    it('doesn\'t open a night whose organizer is gone, nor any for a user without a page', () => {
      expect(open('organizer', { ...NIGHT, organizer: null } as unknown as EventDetailDto)).toBeNull();
      mine = null;
      expect(open('organizer', NIGHT)).toBeNull();
    });

    it('opens any night for the admin', () => {
      expect(open('admin', { ...NIGHT, organizer: { id: 'o2' } } as EventDetailDto)?.id).toBe('e1');
    });

    it('takes a night the backend no longer has for a missing one', () => {
      expect(open('admin', null)).toBeNull();
      expect(open('organizer', null)).toBeNull();
    });
  });

  it('lists the admin\'s tab with its filters, the search trimmed', () => {
    service.list('admin', 'UPCOMING', 1, 20, { organizerId: 'o1', search: '  salsa ' }).subscribe();
    const request = http.expectOne((r) => r.url === url(endpoints.admin.events));
    expect(request.request.params.toString()).toBe('tab=UPCOMING&page=1&size=20&organizerId=o1&q=salsa');
    request.flush({ content: [], page: { size: 20, number: 1, totalElements: 0, totalPages: 0 } });
  });

  it('leaves out the filters the admin didn\'t set', () => {
    service.list('admin', 'PAST', 0, 20, { organizerId: null, search: '   ' }).subscribe();
    const request = http.expectOne((r) => r.url === url(endpoints.admin.events));
    expect(request.request.params.toString()).toBe('tab=PAST&page=0&size=20');
    request.flush({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0 } });
  });

  it('lists the organizer\'s own nights, without filters', () => {
    service.list('organizer', 'CANCELLED', 0, 20, { organizerId: 'o2', search: 'salsa' }).subscribe();
    const request = http.expectOne((r) => r.url === url(endpoints.organizers.myEvents));
    expect(request.request.params.toString()).toBe('tab=CANCELLED&page=0&size=20');
    request.flush({ content: [], page: { size: 20, number: 0, totalElements: 0, totalPages: 0 } });
  });

  it.each([
    ['admin', endpoints.admin.events],
    ['organizer', endpoints.events.create],
  ] as const)('creates the %s\'s night on its endpoint', (scope, path) => {
    service.create(scope, BODY).subscribe();
    const request = http.expectOne(url(path));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(BODY);
    request.flush({});
  });

  it.each([
    ['admin', endpoints.admin.updateEvent('e1'), endpoints.admin.updateEventStatus('e1'), endpoints.admin.deleteEvent('e1')],
    ['organizer', endpoints.events.update('e1'), endpoints.events.updateStatus('e1'), endpoints.events.delete('e1')],
  ] as const)('edits, cancels and deletes the %s\'s night on its endpoints', (scope, update, status, remove) => {
    service.update(scope, 'e1', { title: 'Kizomba' }).subscribe();
    const patch = http.expectOne(url(update));
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ title: 'Kizomba' });
    patch.flush({});

    service.updateStatus(scope, 'e1', 'CANCELLED').subscribe();
    const cancel = http.expectOne(url(status));
    expect(cancel.request.body).toEqual({ status: 'CANCELLED' });
    cancel.flush({});

    service.delete(scope, 'e1').subscribe();
    expect(http.expectOne(url(remove)).request.method).toBe('DELETE');
  });

  it.each([
    ['admin', endpoints.admin.updateEventFlyer('e1')],
    ['organizer', endpoints.events.updateFlyer('e1')],
  ] as const)('sends the %s\'s flyer as the "file" part', (scope, path) => {
    const file = new File(['flyer'], 'flyer.jpg', { type: 'image/jpeg' });
    service.uploadFlyer(scope, 'e1', file).subscribe();
    const request = http.expectOne(url(path));
    expect(request.request.method).toBe('PATCH');
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({});
  });
});
