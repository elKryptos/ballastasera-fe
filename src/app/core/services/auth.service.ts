import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, catchError, of, shareReplay, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserDto } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';
import { endpoints } from '../api/endpoints';
import { Router } from '@angular/router';

/** /auth/me's answers that mean the token's no good: invalid, expired or
 * revoked (401, see SecurityConfig), or its user gone. */
const REFUSED_TOKEN_STATUSES = [401, 403, 404];

/**
 * Session state, backed by the JWT the backend hands out after Google OAuth2
 * (see OAuth2LoginSuccessHandler) and read here from localStorage.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentUserSignal = signal<UserDto | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  /** The last /auth/me check, in flight or settled — see sessionChecked. */
  private sessionCheck: Observable<UserDto | null> | null = null;

  /** Sends the browser to Google's consent screen; the backend redirects back to /oauth2/callback. */
  loginWithGoogle(): void {
    if (!this.isBrowser) return;
    window.location.href = `${environment.apiUrl}${endpoints.auth.googleLogin}`;
  }

  /** Called once by the /oauth2/callback route after it extracts ?token= from the redirect. */
  setToken(token: string): void {
    this.tokenStorage.set(token);
  }

  /** On app start (provideAppInitializer): the stored user at once, checked
   * against /auth/me behind it, so the app doesn't wait on the backend to
   * start. Only with a token but no stored user yet (signed in before users
   * were stored) does it wait for /me, as it always did, rather than show
   * them signed out first. */
  startSession(): Promise<void> {
    const user = this.tokenStorage.get() ? this.tokenStorage.getUser() : null;
    if (user) this.currentUserSignal.set(user);
    const check = this.restoreSession();
    if (user) {
      check.subscribe();
      return Promise.resolve();
    }
    return new Promise((resolve) => check.subscribe({ complete: resolve }));
  }

  /** Loads /rest/auth/me with whatever token is stored, and stores who it
   * answers with. Only the backend refusing the token ends the session: a
   * backend that's down, slow or restarting keeps it as it was, or every
   * visitor would be signed out by it. */
  restoreSession(): Observable<UserDto | null> {
    // The server never has a token, and nobody's signed in there already.
    if (!this.isBrowser) return of(null);
    if (!this.tokenStorage.get()) {
      this.currentUserSignal.set(null);
      return (this.sessionCheck = of(null));
    }

    return (this.sessionCheck = this.http.get<UserDto>(`${environment.apiUrl}${endpoints.auth.me}`).pipe(
      // The bootstrap may be waiting on this (see startSession) — an
      // unreachable/slow API must not hang it indefinitely.
      timeout(5000),
      tap((user) => {
        this.currentUserSignal.set(user);
        this.tokenStorage.setUser(user);
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && REFUSED_TOKEN_STATUSES.includes(error.status)) {
          this.tokenStorage.clear();
          this.currentUserSignal.set(null);
        }
        return of(this.currentUserSignal());
      }),
      shareReplay(1),
    ));
  }

  /** The session once /auth/me has had its say on it — what roleGuard waits
   * for, so a revoked token never opens a guarded page even for a moment. */
  sessionChecked(): Observable<UserDto | null> {
    return this.sessionCheck ?? of(this.currentUserSignal());
  }

  logout() {
    return this.http.post<void>(`${environment.apiUrl}${endpoints.auth.logout}`, {}).pipe(
      catchError(() => of(void 0)),
      tap(() => {
        this.tokenStorage.clear();
        this.currentUserSignal.set(null);
        this.router.navigateByUrl('');
      }),
    );
  }
}
