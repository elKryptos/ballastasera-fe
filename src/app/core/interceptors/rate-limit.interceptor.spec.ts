import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';
import { RATE_LIMITED_MESSAGE, rateLimitInterceptor } from './rate-limit.interceptor';

describe('rateLimitInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([rateLimitInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => backend.verify());

  function refuse(url: string, code: string): unknown {
    let failure: unknown = null;
    http.get(url).subscribe({ error: (error: unknown) => (failure = error) });
    backend.expectOne(url).flush({ errors: { code } }, { status: 429, statusText: 'Too Many Requests' });
    return failure;
  }

  it('tells the user to slow down and still hands the error to the caller', () => {
    const failure = refuse(`${environment.apiUrl}/rest/events`, 'RATE_LIMITED');
    expect(toasts.current()?.message).toBe(RATE_LIMITED_MESSAGE);
    expect(failure).not.toBeNull();
  });

  it('leaves the invites\' own limit to its dialog', () => {
    refuse(`${environment.apiUrl}/rest/users/1/invites`, 'INVITE_LIMIT');
    expect(toasts.current()).toBeNull();
  });

  it('ignores third parties', () => {
    refuse('https://photon.komoot.io/api/', 'RATE_LIMITED');
    expect(toasts.current()).toBeNull();
  });
});
