import { PLATFORM_ID, Service, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'ballastasera.jwt';

/** localStorage wrapper for the JWT — a no-op on the server, since SSR has no storage. */
@Service()
export class TokenStorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  get(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY);
  }

  set(token: string): void {
    if (!this.isBrowser) return;
    localStorage.setItem(STORAGE_KEY, token);
  }

  clear(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(STORAGE_KEY);
  }
}
