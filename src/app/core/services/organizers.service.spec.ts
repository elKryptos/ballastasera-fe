import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { OrganizerDetailDto } from '../models/organizer.model';
import { UserDto } from '../models/user.model';
import { AuthService } from './auth.service';
import { OrganizersService } from './organizers.service';

const url = (path: string) => `${environment.apiUrl}${path}`;
const PAGE = { id: 'o1', name: 'Salsa Loca Milano', logoUrl: null, claimed: true } as OrganizerDetailDto;
const BODY = { name: 'Salsa Loca Isola', description: '', website: '', phone: '', contactEmail: '', instagram: '', facebook: '' };

describe('OrganizersService, the signed-in user\'s page', () => {
  let service: OrganizersService;
  let http: HttpTestingController;
  const currentUser = signal<Partial<UserDto> | null>({ userId: 'u1' });

  /** ensureMine() the first time: it asks the backend, which answers with this list. */
  const loadMine = (answer: OrganizerDetailDto[]) => {
    service.ensureMine().subscribe();
    http.expectOne(url(endpoints.organizers.myOrganizers)).flush(answer);
  };

  beforeEach(() => {
    currentUser.set({ userId: 'u1' });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { currentUser } }],
    });
    service = TestBed.inject(OrganizersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** ensureMine() with nothing to ask: the answer is what's kept, and no request goes out (http.verify). */
  const kept = () => {
    let answer: OrganizerDetailDto | null | undefined;
    service.ensureMine().subscribe((organizer) => (answer = organizer));
    return answer;
  };

  it('is nobody\'s until asked', () => {
    expect(service.myOrganizer()).toBeNull();
  });

  it('keeps the first page the backend answers with, and doesn\'t ask again', () => {
    loadMine([PAGE]);
    expect(service.myOrganizer()).toEqual(PAGE);
    expect(kept()).toEqual(PAGE);
  });

  it('knows a user without a page, and doesn\'t ask again', () => {
    loadMine([]);
    expect(kept()).toBeNull();
  });

  it('asks once for everyone who wants the page while it\'s on its way', () => {
    const answers: (OrganizerDetailDto | null)[] = [];
    service.ensureMine().subscribe((organizer) => answers.push(organizer));
    service.ensureMine().subscribe((organizer) => answers.push(organizer));
    http.expectOne(url(endpoints.organizers.myOrganizers)).flush([PAGE]);
    expect(answers).toEqual([PAGE, PAGE]);
  });

  it('is not shown to the next user who signs in', () => {
    loadMine([PAGE]);
    currentUser.set({ userId: 'u2' });
    expect(service.myOrganizer()).toBeNull();
    loadMine([]);
  });

  it('doesn\'t ask again when the same user is read again (the session check)', () => {
    loadMine([PAGE]);
    currentUser.set({ userId: 'u1' });
    expect(kept()).toEqual(PAGE);
  });

  it('shows what was saved, renamed or with its new logo', () => {
    loadMine([PAGE]);

    service.update('o1', BODY).subscribe();
    const update = http.expectOne(url(endpoints.organizers.update('o1')));
    expect(update.request.method).toBe('PATCH');
    update.flush({ ...PAGE, name: 'Salsa Loca Isola' });
    expect(service.myOrganizer()?.name).toBe('Salsa Loca Isola');

    service.uploadLogo('o1', new File(['x'], 'logo.png', { type: 'image/png' })).subscribe();
    const logo = http.expectOne(url(endpoints.organizers.logo('o1')));
    expect((logo.request.body as FormData).get('logo')).toBeInstanceOf(File);
    logo.flush({ ...PAGE, logoUrl: 'https://cdn/logo.webp' });
    expect(service.myOrganizer()?.logoUrl).toBe('https://cdn/logo.webp');
  });

  it.each([
    ['leaving it', (s: OrganizersService) => s.release('o1'), endpoints.organizers.release('o1'), 'PATCH'],
    ['deleting it', (s: OrganizersService) => s.delete('o1'), endpoints.organizers.delete('o1'), 'DELETE'],
  ])('has no page after %s, and asks next time instead of assuming', (_, act, path, method) => {
    loadMine([PAGE]);
    act(service).subscribe();
    const request = http.expectOne(url(path));
    expect(request.request.method).toBe(method);
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.myOrganizer()).toBeNull();

    // Approved again later, for another page: it's that one that shows.
    loadMine([{ ...PAGE, id: 'o2' }]);
    expect(service.myOrganizer()?.id).toBe('o2');
  });
});
