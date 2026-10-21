import { PLATFORM_ID, Service, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UserDto } from '../models/user.model';

const STORAGE_KEY = 'ballastasera.jwt';
const USER_KEY = 'ballastasera.user';

/** localStorage wrapper for the JWT — a no-op on the server, since SSR has no storage.
 *  It keeps the user /auth/me last returned beside it, so a reload can show them before
 *  /me answers again (AuthService.startSession). */
@Service()
export class TokenStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY);
  }

  /** A new token is a new sign-in, maybe someone else's: the stored user goes with the old one. */
  set(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.removeItem(USER_KEY);
  }

  getUser(): UserDto | null {
    if (!this.isBrowser) return null;
    try {
      const json = localStorage.getItem(USER_KEY);
      return json ? (JSON.parse(json) as UserDto) : null;
    } catch {
      return null;
    }
  }

  setUser(user: UserDto): void {
    if (!this.isBrowser) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
