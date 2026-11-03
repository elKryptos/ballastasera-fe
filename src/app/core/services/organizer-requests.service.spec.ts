import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { endpoints } from '../api/endpoints';
import { OrganizerRequestCreateDto, OrganizerRequestDto } from '../models/organizer-request.model';
import { UserDto } from '../models/user.model';
import { AuthService } from './auth.service';
import { OrganizerRequestsService, SubmittedRequest } from './organizer-requests.service';

const url = (path: string) => `${environment.apiUrl}${path}`;
const REQUEST = { id: 'r1', status: 'PENDING', logoUrl: null } as OrganizerRequestDto;
const BODY = { type: 'NEW', instagram: 'x', contactEmail: 'x@x.it', termsAccepted: true } as OrganizerRequestCreateDto;
const LOGO = new File(['x'], 'logo.png', { type: 'image/png' });

describe('OrganizerRequestsService', () => {
  let service: OrganizerRequestsService;
  let http: HttpTestingController;
  const currentUser = signal<Partial<UserDto> | null>({ userId: 'u1' });
  let sessionChecks: number;

  beforeEach(() => {
    currentUser.set({ userId: 'u1' });
    sessionChecks = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            currentUser,
            restoreSession: () => {
              sessionChecks++;
              return of(null);
            },
          },
        },
      ],
    });
    service = TestBed.inject(OrganizerRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads a 204 as no request', () => {
    let answer: OrganizerRequestDto | null | undefined;
    service.load().subscribe((request) => (answer = request));
    http.expectOne(url(endpoints.organizerRequests.me)).flush(null, { status: 204, statusText: 'No Content' });
    expect(answer).toBeNull();
    expect(service.myRequest()).toBeNull();
  });

  it('asks once per user', () => {
    service.ensureLoaded().subscribe();
    http.expectOne(url(endpoints.organizerRequests.me)).flush(REQUEST);

    service.ensureLoaded().subscribe();
    http.expectNone(url(endpoints.organizerRequests.me));

    currentUser.set({ userId: 'u2' });
    service.ensureLoaded().subscribe();
    http.expectOne(url(endpoints.organizerRequests.me)).flush(null, { status: 204, statusText: 'No Content' });
    expect(service.myRequest()).toBeNull();
  });

  describe('a request leaving review', () => {
    const answers = (status: string) => {
      service.load().subscribe();
      http.expectOne(url(endpoints.organizerRequests.me)).flush({ ...REQUEST, status });
    };

    it.each(['APPROVED', 'REJECTED'])('rereads the role when it comes back %s', (status) => {
      answers('PENDING');
      expect(sessionChecks).toBe(0);
      answers(status);
      expect(service.myRequest()?.status).toBe(status);
      expect(sessionChecks).toBe(1);
    });

    it('leaves the role alone while it stays in review', () => {
      answers('PENDING');
      answers('PENDING');
      expect(sessionChecks).toBe(0);
    });

    it('leaves the role alone for one that was never in review here', () => {
      answers('APPROVED');
      answers('APPROVED');
      expect(sessionChecks).toBe(0);
    });
  });

  it('owns up to a failed load, and clears it on the next answer', () => {
    service.load().subscribe({ error: () => {} });
    http.expectOne(url(endpoints.organizerRequests.me)).flush(null, { status: 500, statusText: 'Error' });
    expect(service.loadFailed()).toBe(true);

    service.load().subscribe();
    http.expectOne(url(endpoints.organizerRequests.me)).flush(REQUEST);
    expect(service.loadFailed()).toBe(false);
  });

  it('sends the logo in the "logo" part after creating', () => {
    let result: SubmittedRequest | undefined;
    service.submit(BODY, LOGO).subscribe((submitted) => (result = submitted));
    http.expectOne(url(endpoints.organizerRequests.create)).flush(REQUEST);

    const upload = http.expectOne(url(endpoints.organizerRequests.logo('r1')));
    expect((upload.request.body as FormData).get('logo')).toBeInstanceOf(File);
    upload.flush({ ...REQUEST, logoUrl: 'http://logo' });

    expect(result).toEqual({ request: { ...REQUEST, logoUrl: 'http://logo' }, logoUploaded: true });
    expect(service.myRequest()?.logoUrl).toBe('http://logo');
  });

  it('retries the logo once, then keeps the request without it', () => {
    let result: SubmittedRequest | undefined;
    service.submit(BODY, LOGO).subscribe((submitted) => (result = submitted));
    http.expectOne(url(endpoints.organizerRequests.create)).flush(REQUEST);

    http.expectOne(url(endpoints.organizerRequests.logo('r1'))).flush(null, { status: 500, statusText: 'Error' });
    http.expectOne(url(endpoints.organizerRequests.logo('r1'))).flush(null, { status: 500, statusText: 'Error' });

    expect(result).toEqual({ request: REQUEST, logoUploaded: false });
  });

  it('does not upload without a logo', () => {
    let result: SubmittedRequest | undefined;
    service.submit(BODY, null).subscribe((submitted) => (result = submitted));
    http.expectOne(url(endpoints.organizerRequests.create)).flush(REQUEST);
    expect(result?.logoUploaded).toBe(true);
  });

  it('reloads the request after cancelling', () => {
    service.cancel('r1').subscribe();
    http.expectOne(url(endpoints.organizerRequests.cancel('r1'))).flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(url(endpoints.organizerRequests.me)).flush({ ...REQUEST, status: 'CANCELLED' });
    expect(service.myRequest()?.status).toBe('CANCELLED');
  });
});
