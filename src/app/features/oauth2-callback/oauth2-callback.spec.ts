import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { Oauth2Callback } from './oauth2-callback';

describe('Oauth2Callback', () => {
  let user: { loginCount: number } | null;
  let returnUrl: string | null;
  let taken: number;

  /** Lands with ?token= and says where the login went on to. */
  const landing = async (): Promise<string> => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ token: 'jwt' }) } } },
        { provide: FeatureFlagService, useValue: { isEnabled: () => true } },
        {
          provide: AuthService,
          useValue: {
            setToken: () => {},
            restoreSession: () => of(user),
            currentUser: () => user,
            takeReturnUrl: () => (taken++, returnUrl),
          },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Oauth2Callback);
    await fixture.whenStable();
    return navigate.mock.calls[0][0] as string;
  };

  beforeEach(() => {
    user = { loginCount: 5 };
    returnUrl = null;
    taken = 0;
  });

  it('goes back to where the login was asked for, even on a first login', async () => {
    user = { loginCount: 1 };
    returnUrl = '/diventa-organizzatore/chi-sei?rivendica=salsa-loca';
    expect(await landing()).toBe('/diventa-organizzatore/chi-sei?rivendica=salsa-loca');
  });

  it('lands on the usual page without one', async () => {
    expect(await landing()).toBe('/menu');
    // Read anyway, so a returnUrl left behind can't steer a later login.
    expect(taken).toBe(1);
  });

  it('welcomes a first login without one', async () => {
    user = { loginCount: 1 };
    expect(await landing()).toBe('/benvenuto');
  });

  it('does not follow it when the session could not be confirmed', async () => {
    user = null;
    returnUrl = '/diventa-organizzatore/chi-sei?rivendica=salsa-loca';
    expect(await landing()).toBe('/');
  });
});
