import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { FeatureFlagService } from './feature-flag.service';
import { ORGANIZER_WELCOME_URL, watchOrganizerRequest } from './organizer-request-watcher';
import { OrganizerRequestsService } from './organizer-requests.service';

describe('watchOrganizerRequest', () => {
  const currentUser = signal<{ role: string } | null>({ role: 'USER' });
  const myRequest = signal<{ status: string; acknowledgedAt?: string | null } | null>(null);
  let visibility: DocumentVisibilityState;
  let loads: number;
  let ensures: number;
  let navigations: string[];

  const start = (flag = true) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation((url) => {
      navigations.push(String(url));
      return Promise.resolve(true);
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
    navigations = [];
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each(['USER', 'ORGANIZER'])('loads the request of a %s', (role) => {
    currentUser.set({ role });
    start();
    expect(ensures).toBe(1);
  });

  it('asks nothing of an admin', () => {
    currentUser.set({ role: 'ADMIN' });
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

  describe('the welcome', () => {
    it('takes someone just approved to it', () => {
      currentUser.set({ role: 'ORGANIZER' });
      myRequest.set({ status: 'APPROVED', acknowledgedAt: null });
      start();
      expect(navigations).toEqual([ORGANIZER_WELCOME_URL]);
    });

    it('takes them there the moment the approval arrives', () => {
      myRequest.set({ status: 'PENDING' });
      start();
      expect(navigations).toEqual([]);

      myRequest.set({ status: 'APPROVED', acknowledgedAt: null });
      currentUser.set({ role: 'ORGANIZER' });
      TestBed.tick();
      expect(navigations).toEqual([ORGANIZER_WELCOME_URL]);
    });

    it('does not repeat itself once seen', () => {
      currentUser.set({ role: 'ORGANIZER' });
      myRequest.set({ status: 'APPROVED', acknowledgedAt: '2026-11-03T20:00:00Z' });
      start();
      expect(navigations).toEqual([]);
    });

    it('is not for a user who gave the page up: the role says so', () => {
      myRequest.set({ status: 'APPROVED', acknowledgedAt: null });
      start();
      expect(navigations).toEqual([]);
    });
  });
});
