import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { injectMyOrganizerName } from './my-organizer-name';

describe('injectMyOrganizerName', () => {
  const currentUser = signal<{ role: string } | null>(null);
  let answer: () => Observable<{ name: string }[]>;
  let asks: number;

  const start = async (flag = true): Promise<Signal<string | null>> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FeatureFlagService, useValue: { isEnabled: () => flag } },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: OrganizersService,
          useValue: {
            getMyOrganizers: () => {
              asks++;
              return answer();
            },
          },
        },
      ],
    });
    const name = TestBed.runInInjectionContext(() => injectMyOrganizerName());
    TestBed.tick();
    return name;
  };

  beforeEach(() => {
    currentUser.set({ role: 'ORGANIZER' });
    answer = () => of([{ name: 'Salsa Loca Milano' }]);
    asks = 0;
  });

  it('gives an organizer the name of their page', async () => {
    const name = await start();
    expect(name()).toBe('Salsa Loca Milano');
  });

  it.each(['USER', 'ADMIN'])('asks nothing for a %s', async (role) => {
    currentUser.set({ role });
    const name = await start();
    expect(name()).toBeNull();
    expect(asks).toBe(0);
  });

  it('asks nothing with the flag off', async () => {
    const name = await start(false);
    expect(name()).toBeNull();
    expect(asks).toBe(0);
  });

  it('shows up the moment someone is approved', async () => {
    currentUser.set({ role: 'USER' });
    const name = await start();
    expect(name()).toBeNull();

    currentUser.set({ role: 'ORGANIZER' });
    TestBed.tick();
    expect(name()).toBe('Salsa Loca Milano');
  });

  it('goes away when the page is given up', async () => {
    const name = await start();
    currentUser.set({ role: 'USER' });
    TestBed.tick();
    expect(name()).toBeNull();
  });

  it('stays out of the way if it does not load, or there is none', async () => {
    answer = () => throwError(() => new Error('down'));
    const failed = await start();
    expect(failed()).toBeNull();

    TestBed.resetTestingModule();
    answer = () => of([]);
    const none = await start();
    expect(none()).toBeNull();
  });
});
