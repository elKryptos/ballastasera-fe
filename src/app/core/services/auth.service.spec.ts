import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

/** loginWithGoogle() keeps it here before leaving for Google. */
const RETURN_URL_KEY = 'auth.returnUrl';

describe('AuthService.takeReturnUrl', () => {
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => sessionStorage.clear());

  it('gives back the path kept before the login, once', () => {
    sessionStorage.setItem(RETURN_URL_KEY, '/diventa-organizzatore/chi-sei?rivendica=salsa-loca');

    expect(auth.takeReturnUrl()).toBe('/diventa-organizzatore/chi-sei?rivendica=salsa-loca');
    expect(auth.takeReturnUrl()).toBeNull();
  });

  it('is null when nothing was kept', () => {
    expect(auth.takeReturnUrl()).toBeNull();
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)'])(
    'never leaves the app for %s',
    (url) => {
      sessionStorage.setItem(RETURN_URL_KEY, url);

      expect(auth.takeReturnUrl()).toBeNull();
      expect(sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
    },
  );
});
