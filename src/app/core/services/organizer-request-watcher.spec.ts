import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { FeatureFlagService } from './feature-flag.service';
import { watchOrganizerRequest } from './organizer-request-watcher';
import { OrganizerRequestsService } from './organizer-requests.service';

describe('watchOrganizerRequest', () => {
  const currentUser = signal<{ role: string } | null>({ role: 'USER' });
  const myRequest = signal<{ status: string } | null>(null);
  let visibility: DocumentVisibilityState;
  let loads: number;
  let ensures: number;

  const start = (flag = true) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FeatureFlagService, useValue: { isEnabled: () => flag } },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: OrganizerRequestsService,
          useValue: {
            myRequest,
            load: () => {
              loads++;
              return of(null);
            },
            ensureLoaded: () => {
              ensures++;
              return of(null);
            },
          },
        },
      ],
    });
    TestBed.runInInjectionContext(() => watchOrganizerRequest());
    TestBed.tick();
  };
  const backToTab = () => document.dispatchEvent(new Event('visibilitychange'));

  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    currentUser.set({ role: 'USER' });
    myRequest.set(null);
    loads = 0;
    ensures = 0;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loads the request of a user', () => {
    start();
    expect(ensures).toBe(1);
  });

  it('asks nothing of an organizer or an admin', () => {
    currentUser.set({ role: 'ORGANIZER' });
    start();
    expect(ensures).toBe(0);
  });

  it('asks nothing with the flag off', () => {
    start(false);
    backToTab();
    expect(ensures).toBe(0);
    expect(loads).toBe(0);
  });

  describe('while in review', () => {
    beforeEach(() => myRequest.set({ status: 'PENDING' }));

    it('asks on coming back to the tab', () => {
      start();
      backToTab();
      expect(loads).toBe(1);
    });

    it('asks once a minute', () => {
      start();
      vi.advanceTimersByTime(59_000);
      expect(loads).toBe(0);
      vi.advanceTimersByTime(1_000);
      expect(loads).toBe(1);
      vi.advanceTimersByTime(60_000);
      expect(loads).toBe(2);
    });

    it('rests while the tab is out of view', () => {
      visibility = 'hidden';
      start();
      backToTab();
      vi.advanceTimersByTime(120_000);
      expect(loads).toBe(0);
    });
  });

  it.each(['APPROVED', 'REJECTED', 'CANCELLED'])('stops asking once %s', (status) => {
    myRequest.set({ status });
    start();
    backToTab();
    vi.advanceTimersByTime(120_000);
    expect(loads).toBe(0);
  });
});
