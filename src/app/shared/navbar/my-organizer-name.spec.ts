import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, map, of, tap, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { FeatureFlagService } from '../../core/services/feature-flag.service';
import { OrganizersService } from '../../core/services/organizers.service';
import { injectMyOrganizerName } from './my-organizer-name';

describe('injectMyOrganizerName', () => {
  const currentUser = signal<{ role: string } | null>(null);
  /** OrganizersService.myOrganizer: what ensureMine() answered, and what's saved since. */
  const myOrganizer = signal<{ name: string } | null>(null);
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
            myOrganizer,
            ensureMine: () => {
              asks++;
              return answer().pipe(
                map((owned) => owned[0] ?? null),
                tap((organizer) => myOrganizer.set(organizer)),
              );
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
    myOrganizer.set(null);
    answer = () => of([{ name: 'Salsa Loca Milano' }]);
    asks = 0;
  });

  it('shows a new name the moment it is saved', async () => {
    const name = await start();
    myOrganizer.set({ name: 'Salsa Loca Isola' });
    expect(name()).toBe('Salsa Loca Isola');
    expect(asks).toBe(1);
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
